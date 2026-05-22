jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), render: jest.fn() },
}));

import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AiSidebar } from './ai-sidebar';
import { Ai } from './ai';

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

function installAvailable(promptReturn = '{"message":"hi","action":{"type":"none"}}'): void {
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

afterEach(() => {
  delete (globalThis as unknown as { LanguageModel?: unknown }).LanguageModel;
});

describe('AiSidebar', () => {
  it('renders the unavailable state when LanguageModel is undefined', async () => {
    await render(AiSidebar, { providers: baseProviders() });
    await settle();
    expect(screen.getByText(/ai assistant unavailable/i)).toBeInTheDocument();
  });

  it('renders the chat surface when AI is available', async () => {
    installAvailable();
    await render(AiSidebar, { providers: baseProviders() });
    await settle();
    expect(
      screen.getByRole('textbox', { name: /message/i }),
    ).toBeInTheDocument();
    // The picker loads instructions on init — drain that request.
    const http = TestBed.inject(HttpTestingController);
    const pending = http.match('/api/pages/root/children');
    pending.forEach((r) => r.flush({ children: [] }));
  });

  it('sends a message via Ai.sendMessage when the form is submitted', async () => {
    installAvailable(
      '{"message":"sure","action":{"type":"none"}}',
    );
    const { fixture } = await render(AiSidebar, { providers: baseProviders() });
    await settle();
    const http = TestBed.inject(HttpTestingController);
    http.match('/api/pages/root/children').forEach((r) => r.flush({ children: [] }));
    await settle();

    const ai = TestBed.inject(Ai);
    const spy = jest.spyOn(ai, 'sendMessage');

    // Drive the draft signal directly to bypass jsdom ngModel timing.
    interface SidebarCmp {
      draft: { set(v: string): void; (): string };
      onSubmit(event: Event): void;
      canSend(): boolean;
    }
    const cmp = fixture.componentInstance as unknown as SidebarCmp;
    cmp.draft.set('hello');
    await settle();
    fixture.detectChanges();
    expect(cmp.draft()).toBe('hello');
    expect(cmp.canSend()).toBe(true);

    cmp.onSubmit(new Event('submit', { cancelable: true, bubbles: true }));
    await settle();

    // Drain context-loader requests (search + maybe page lookup) iteratively
    // until everything settles.
    for (let i = 0; i < 6; i++) {
      const pending = http.match(() => true);
      if (pending.length === 0) break;
      pending.forEach((r) =>
        r.flush({ results: [], totalResults: 0, executionTimeMs: 0 }),
      );
      await settle();
    }

    expect(spy).toHaveBeenCalled();
    const firstCall = spy.mock.calls[0];
    expect(firstCall?.[0]).toBe('hello');
  });

  it('emits closed when the close button is clicked', async () => {
    installAvailable();
    const onClosed = jest.fn();
    await render(AiSidebar, {
      providers: baseProviders(),
      on: { closed: onClosed },
    });
    await settle();
    const http = TestBed.inject(HttpTestingController);
    http.match('/api/pages/root/children').forEach((r) => r.flush({ children: [] }));
    await settle();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /close ai assistant/i }));
    expect(onClosed).toHaveBeenCalled();
  });
});
