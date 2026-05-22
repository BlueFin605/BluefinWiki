import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { InstructionPicker } from './instruction-picker';

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
});
