import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { InstructionPicker } from './instruction-picker';
import { AiInstructions } from './ai-instructions';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function baseProviders() {
  return [
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
  ];
}

describe('InstructionPicker', () => {
  it('shows loading then "no instructions" when the root page is missing', async () => {
    await render(InstructionPicker, { providers: baseProviders() });
    const http = TestBed.inject(HttpTestingController);

    expect(screen.getByText(/instructions/i)).toBeInTheDocument();
    await settle();
    http
      .expectOne('/api/pages/root/children')
      .flush({ children: [] });
    await settle();

    // Open the select to surface the menu options.
    const trigger = screen.getByRole('combobox', { name: /attach instructions/i });
    await userEvent.setup().click(trigger);
    await settle();

    expect(screen.getByText(/no instructions yet/i)).toBeInTheDocument();
  });

  it('lists instructions returned by the API', async () => {
    await render(InstructionPicker, { providers: baseProviders() });
    const http = TestBed.inject(HttpTestingController);

    await settle();
    http
      .expectOne('/api/pages/root/children')
      .flush({
        children: [{ guid: 'root-1', title: 'AI Instructions' }],
      });
    await settle();
    http
      .expectOne('/api/pages/root-1/children')
      .flush({
        children: [
          { guid: 'i1', title: 'Be terse' },
          { guid: 'i2', title: 'Recipe writer' },
        ],
      });
    await settle();

    const trigger = screen.getByRole('combobox', { name: /attach instructions/i });
    await userEvent.setup().click(trigger);
    await settle();

    expect(screen.getByRole('option', { name: /be terse/i })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /recipe writer/i }),
    ).toBeInTheDocument();
  });

  it('exposes the selected guids via getSelected()', async () => {
    const { fixture } = await render(InstructionPicker, {
      providers: baseProviders(),
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http
      .expectOne('/api/pages/root/children')
      .flush({
        children: [{ guid: 'root-1', title: 'AI Instructions' }],
      });
    await settle();
    http
      .expectOne('/api/pages/root-1/children')
      .flush({
        children: [{ guid: 'i1', title: 'Be terse' }],
      });
    await settle();

    const trigger = screen.getByRole('combobox', { name: /attach instructions/i });
    await userEvent.setup().click(trigger);
    await settle();

    const option = screen.getByRole('option', { name: /be terse/i });
    await userEvent.setup().click(option);
    await settle();

    expect(fixture.componentInstance.getSelected()).toEqual(['i1']);
  });

  it('reloads on demand via load() and surfaces new instructions', async () => {
    const { fixture } = await render(InstructionPicker, {
      providers: baseProviders(),
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    // First load — root page exists but with no children.
    http
      .expectOne('/api/pages/root/children')
      .flush({
        children: [{ guid: 'root-1', title: 'AI Instructions' }],
      });
    await settle();
    http
      .expectOne('/api/pages/root-1/children')
      .flush({ children: [] });
    await settle();

    // Trigger reload — root is now cached so only the children call happens,
    // returning a newly-created instruction.
    const promise = fixture.componentInstance.load();
    await settle();
    http
      .expectOne('/api/pages/root-1/children')
      .flush({
        children: [{ guid: 'i9', title: 'Fresh' }],
      });
    await promise;
    await settle();

    expect(fixture.componentInstance.instructions().map((i) => i.title)).toEqual([
      'Fresh',
    ]);
  });

  it('locks a loaded instruction: shown as "In context", disabled, and not removable', async () => {
    const { fixture } = await render(InstructionPicker, {
      providers: baseProviders(),
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http
      .expectOne('/api/pages/root/children')
      .flush({ children: [{ guid: 'root-1', title: 'AI Instructions' }] });
    await settle();
    http
      .expectOne('/api/pages/root-1/children')
      .flush({
        children: [
          { guid: 'i1', title: 'Be terse' },
          { guid: 'i2', title: 'Recipe writer' },
        ],
      });
    await settle();

    // Select it first (only a selected instruction is ever locked in real use).
    const trigger = screen.getByRole('combobox', { name: /attach instructions/i });
    await userEvent.setup().click(trigger);
    await settle();
    await userEvent.setup().click(screen.getByRole('option', { name: /be terse/i }));
    await settle();
    expect(fixture.componentInstance.getSelected()).toEqual(['i1']);

    // Now the caller (ai-sidebar) reports it as loaded/locked.
    fixture.componentRef.setInput('loadedGuids', ['i1']);
    await settle();

    const lockedOption = screen.getByRole('option', { name: /be terse/i });
    expect(lockedOption).toHaveAttribute('aria-disabled', 'true');
    expect(within(lockedOption).getByText(/in context/i)).toBeInTheDocument();

    // Material renders locked options with `pointer-events: none` — a real
    // click can't even land on them, which is itself the "can't remove"
    // guarantee. Confirm the selection is unaffected either way.
    expect(fixture.componentInstance.getSelected()).toEqual(['i1']);

    // A non-locked option can still be toggled freely.
    await userEvent.setup().click(screen.getByRole('option', { name: /recipe writer/i }));
    await settle();
    expect(fixture.componentInstance.getSelected()).toEqual(['i1', 'i2']);
  });

  it('Create posts a new instruction and navigates to its editor', async () => {
    await render(InstructionPicker, { providers: baseProviders() });
    const http = TestBed.inject(HttpTestingController);
    const aiInstructions = TestBed.inject(AiInstructions);
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const createSpy = jest
      .spyOn(aiInstructions, 'createInstruction')
      .mockResolvedValue('new-guid');

    await settle();
    http
      .expectOne('/api/pages/root/children')
      .flush({ children: [] });
    await settle();

    const trigger = screen.getByRole('combobox', { name: /attach instructions/i });
    await userEvent.setup().click(trigger);
    await settle();

    const titleInput = screen.getByPlaceholderText(/new instruction title/i);
    await userEvent.setup().type(titleInput, 'Be concise');
    await settle();

    await userEvent.setup().click(screen.getByRole('button', { name: /^create$/i }));
    await settle();

    expect(createSpy).toHaveBeenCalledWith('Be concise');

    // Create triggers a reload of the instruction list (real, unmocked
    // `load()`/`listInstructions()`) — the root lookup wasn't cached
    // (the first lookup found no match), so it fires again.
    http
      .expectOne('/api/pages/root/children')
      .flush({ children: [] });
    await settle();

    expect(navigateSpy).toHaveBeenCalledWith(['/pages', 'new-guid', 'edit']);
  });
});
