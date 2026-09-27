import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Ai } from './ai';
import { ActionPreview } from './action-preview';
import { AiActionRunner, type ActionRunResult } from './ai-action-runner';
import { PageTitleResolver } from './page-title-resolver';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function baseProviders() {
  return [
    provideRouter([]),
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
  ];
}

describe('ActionPreview', () => {
  afterEach(() => {
    delete (globalThis as unknown as { LanguageModel?: unknown }).LanguageModel;
  });

  it('renders nothing when there is no pending action', async () => {
    const { container } = await render(ActionPreview, {
      providers: baseProviders(),
    });
    expect(container.querySelector('.preview')).toBeNull();
  });

  it('renders create_page details when an action is pending', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    const ai = TestBed.inject(Ai);
    installStub(
      '{"message":"sure","action":{"type":"create_page","title":"My Page"}}',
    );
    await ai.sendMessage('please');
    await settle();

    expect(screen.getByText('Create page')).toBeInTheDocument();
    expect(screen.getByText('My Page')).toBeInTheDocument();
  });

  it('clicking Apply dispatches through AiActionRunner and moves status pending -> applying -> applied', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    const ai = TestBed.inject(Ai);
    installStub(
      '{"message":"ok","action":{"type":"update_page","pageGuid":"g","title":"new"}}',
    );
    await ai.sendMessage('rename');
    await settle();

    let resolveRun!: (r: ActionRunResult) => void;
    const runPromise = new Promise<ActionRunResult>((res) => {
      resolveRun = res;
    });
    jest.spyOn(TestBed.inject(AiActionRunner), 'run').mockReturnValue(runPromise);

    const apply = screen.getByRole('button', { name: /^apply$/i });
    await userEvent.setup().click(apply);
    await settle();

    const assistant = ai.messages().find((m) => m.role === 'assistant');
    expect(assistant?.actionStatus).toBe('applying');
    expect(ai.currentAction()).not.toBeNull();

    resolveRun({ ok: true });
    await settle();

    expect(ai.currentAction()).toBeNull();
    expect(ai.messages().find((m) => m.role === 'assistant')?.actionStatus).toBe(
      'applied',
    );
  });

  it('clicking Apply on a failure keeps the action current, shows failed status, and renders the server message', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    const ai = TestBed.inject(Ai);
    installStub(
      '{"message":"ok","action":{"type":"update_page","pageGuid":"g","title":"new"}}',
    );
    await ai.sendMessage('rename');
    await settle();

    jest
      .spyOn(TestBed.inject(AiActionRunner), 'run')
      .mockResolvedValue({ ok: false, error: 'Title already in use' });

    const apply = screen.getByRole('button', { name: /^apply$/i });
    await userEvent.setup().click(apply);
    await settle();

    expect(ai.currentAction()).not.toBeNull();
    expect(ai.messages().find((m) => m.role === 'assistant')?.actionStatus).toBe(
      'failed',
    );
    expect(screen.getByText(/title already in use/i)).toBeInTheDocument();
    // Retry is still possible: the Apply button is still on the card.
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeInTheDocument();
  });

  it('clicking Discard calls Ai.rejectAction and clears the preview', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    const ai = TestBed.inject(Ai);
    installStub(
      '{"message":"ok","action":{"type":"update_page","pageGuid":"g","title":"new"}}',
    );
    await ai.sendMessage('rename');
    await settle();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /discard/i }));
    await settle();

    expect(ai.currentAction()).toBeNull();
    expect(ai.messages().find((m) => m.role === 'assistant')?.actionStatus).toBe(
      'discarded',
    );
  });

  it('resolves referenced GUIDs to page titles, with a link to the page', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    jest
      .spyOn(TestBed.inject(PageTitleResolver), 'resolveTitle')
      .mockImplementation((guid: string) =>
        Promise.resolve(guid === 'parent-1' ? 'Parent Title' : guid),
      );
    const ai = TestBed.inject(Ai);
    installStub(
      '{"message":"sure","action":{"type":"create_page","title":"Child","parentGuid":"parent-1"}}',
    );
    await ai.sendMessage('please');
    await settle();
    await settle();

    const link = await screen.findByRole('link', { name: 'Parent Title' });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('parent-1');
    expect(screen.queryByText('parent-1')).toBeNull();
  });

  it('falls back to the raw GUID when title resolution fails', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    jest
      .spyOn(TestBed.inject(PageTitleResolver), 'resolveTitle')
      .mockImplementation((guid: string) => Promise.resolve(guid));
    const ai = TestBed.inject(Ai);
    installStub(
      '{"message":"sure","action":{"type":"update_page","pageGuid":"unresolvable-guid","title":"X"}}',
    );
    await ai.sendMessage('please');
    await settle();
    await settle();

    const link = await screen.findByRole('link', { name: 'unresolvable-guid' });
    expect(link).toBeInTheDocument();
  });
});

function installStub(promptReturn: string): void {
  (globalThis as unknown as { LanguageModel: unknown }).LanguageModel = {
    availability: jest.fn().mockResolvedValue('available'),
    create: jest.fn().mockResolvedValue({
      prompt: jest.fn().mockResolvedValue(promptReturn),
      promptStreaming: jest.fn(),
      destroy: jest.fn(),
      inputUsage: 100,
      inputQuota: 1000,
    }),
  };
}
