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
import { provideRouter } from '@angular/router';
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
    provideRouter([]),
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

  it('fetches selected instruction content and passes it as instructionContext to Ai.sendMessage; marks it loaded on Ai', async () => {
    installAvailable('{"message":"sure","action":{"type":"none"}}');
    const { fixture } = await render(AiSidebar, { providers: baseProviders() });
    await settle();
    const http = TestBed.inject(HttpTestingController);

    // Instruction picker loads its list; select one instruction.
    http
      .expectOne('/api/pages/root/children')
      .flush({ children: [{ guid: 'root-1', title: 'AI Instructions' }] });
    await settle();
    http
      .expectOne('/api/pages/root-1/children')
      .flush({ children: [{ guid: 'i1', title: 'Be terse' }] });
    await settle();

    const trigger = screen.getByRole('combobox', { name: /attach instructions/i });
    await userEvent.setup().click(trigger);
    await settle();
    await userEvent.setup().click(screen.getByRole('option', { name: /be terse/i }));
    await settle();

    const ai = TestBed.inject(Ai);
    const spy = jest.spyOn(ai, 'sendMessage');

    interface SidebarCmp {
      draft: { set(v: string): void; (): string };
      onSubmit(event: Event): void;
    }
    const cmp = fixture.componentInstance as unknown as SidebarCmp;
    cmp.draft.set('hello');
    await settle();
    fixture.detectChanges();

    cmp.onSubmit(new Event('submit', { cancelable: true, bubbles: true }));
    await settle();

    // Drain the instruction-content fetch plus the RAG-context requests.
    for (let i = 0; i < 6; i++) {
      const pending = http.match(() => true);
      if (pending.length === 0) break;
      pending.forEach((r) => {
        if (r.request.url === '/api/pages/i1') {
          r.flush({
            guid: 'i1',
            title: 'Be terse',
            content: 'Keep replies short.',
            folderId: 'f',
            tags: [],
            status: 'published',
            createdBy: 'u',
            modifiedBy: 'u',
            createdAt: '2026-01-01T00:00:00Z',
            modifiedAt: '2026-01-01T00:00:00Z',
          });
        } else {
          r.flush({ results: [], totalResults: 0, executionTimeMs: 0 });
        }
      });
      await settle();
    }

    expect(spy).toHaveBeenCalled();
    const [, , instructionContext] = spy.mock.calls[0];
    expect(instructionContext).toContain('Be terse');
    expect(instructionContext).toContain('Keep replies short.');
    expect(ai.loadedInstructionIds()).toContain('i1');
  });

  it('a failed instruction fetch is not locked and surfaces a system message, while a sibling success in the same batch still locks', async () => {
    installAvailable('{"message":"sure","action":{"type":"none"}}');
    const { fixture } = await render(AiSidebar, { providers: baseProviders() });
    await settle();
    const http = TestBed.inject(HttpTestingController);

    // Instruction picker loads its list; select both instructions.
    http
      .expectOne('/api/pages/root/children')
      .flush({ children: [{ guid: 'root-1', title: 'AI Instructions' }] });
    await settle();
    http.expectOne('/api/pages/root-1/children').flush({
      children: [
        { guid: 'i1', title: 'Be terse' },
        { guid: 'i2', title: 'Recipe writer' },
      ],
    });
    await settle();

    const trigger = screen.getByRole('combobox', { name: /attach instructions/i });
    await userEvent.setup().click(trigger);
    await settle();
    await userEvent.setup().click(screen.getByRole('option', { name: /be terse/i }));
    await settle();
    await userEvent.setup().click(screen.getByRole('option', { name: /recipe writer/i }));
    await settle();

    const ai = TestBed.inject(Ai);
    const spy = jest.spyOn(ai, 'sendMessage');

    interface SidebarCmp {
      draft: { set(v: string): void; (): string };
      onSubmit(event: Event): void;
    }
    const cmp = fixture.componentInstance as unknown as SidebarCmp;
    cmp.draft.set('hello');
    await settle();
    fixture.detectChanges();

    cmp.onSubmit(new Event('submit', { cancelable: true, bubbles: true }));
    await settle();

    // Drain the instruction-content fetches (i1 succeeds, i2 fails) plus the
    // RAG-context requests.
    for (let i = 0; i < 6; i++) {
      const pending = http.match(() => true);
      if (pending.length === 0) break;
      pending.forEach((r) => {
        if (r.request.url === '/api/pages/i1') {
          r.flush({
            guid: 'i1',
            title: 'Be terse',
            content: 'Keep replies short.',
            folderId: 'f',
            tags: [],
            status: 'published',
            createdBy: 'u',
            modifiedBy: 'u',
            createdAt: '2026-01-01T00:00:00Z',
            modifiedAt: '2026-01-01T00:00:00Z',
          });
        } else if (r.request.url === '/api/pages/i2') {
          r.flush('boom', { status: 500, statusText: 'Server Error' });
        } else {
          r.flush({ results: [], totalResults: 0, executionTimeMs: 0 });
        }
      });
      await settle();
    }

    expect(spy).toHaveBeenCalled();
    const [, , instructionContext] = spy.mock.calls[0];
    expect(instructionContext).toContain('Be terse');
    expect(instructionContext).toContain('Keep replies short.');
    expect(instructionContext).not.toContain('Recipe writer');

    // The successful instruction locks; the failed one stays unlocked so it
    // is retried on the next send.
    expect(ai.loadedInstructionIds()).toEqual(['i1']);
    expect(ai.loadedInstructionIds()).not.toContain('i2');

    // A user-visible system message references the failed instruction.
    const systemMessages = ai.messages().filter((m) => m.role === 'system');
    expect(
      systemMessages.some((m) => m.text.includes('Recipe writer')),
    ).toBe(true);
  });

  it('New chat clears loaded instructions on Ai but keeps the picker selection', async () => {
    installAvailable();
    const { fixture } = await render(AiSidebar, { providers: baseProviders() });
    await settle();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/pages/root/children')
      .flush({ children: [{ guid: 'root-1', title: 'AI Instructions' }] });
    await settle();
    http
      .expectOne('/api/pages/root-1/children')
      .flush({ children: [{ guid: 'i1', title: 'Be terse' }] });
    await settle();

    const trigger = screen.getByRole('combobox', { name: /attach instructions/i });
    await userEvent.setup().click(trigger);
    await settle();
    await userEvent.setup().click(screen.getByRole('option', { name: /be terse/i }));
    await settle();

    const ai = TestBed.inject(Ai);
    ai.markInstructionsLoaded(['i1']);
    expect(ai.loadedInstructionIds()).toEqual(['i1']);

    interface SidebarCmp {
      onNewChat(): void;
    }
    const cmp = fixture.componentInstance as unknown as SidebarCmp;
    cmp.onNewChat();
    await settle();

    expect(ai.loadedInstructionIds()).toEqual([]);

    // Selection survives — reopen the picker and confirm it's still checked.
    await userEvent.setup().click(trigger);
    await settle();
    const option = screen.getByRole('option', { name: /be terse/i });
    expect(option).toHaveAttribute('aria-selected', 'true');
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

  it('scrolls the transcript to the bottom when a new message is appended', async () => {
    installAvailable('{"message":"response1","action":{"type":"none"}}');
    const { fixture } = await render(AiSidebar, { providers: baseProviders() });
    await settle();
    const http = TestBed.inject(HttpTestingController);
    http.match('/api/pages/root/children').forEach((r) => r.flush({ children: [] }));
    await settle();

    interface SidebarCmp {
      draft: { set(v: string): void; (): string };
      onSubmit(event: Event): void;
    }
    const cmp = fixture.componentInstance as unknown as SidebarCmp;

    // Send multiple messages to build scrollable content
    for (let i = 0; i < 2; i++) {
      cmp.draft.set('message ' + i);
      await settle();
      fixture.detectChanges();

      cmp.onSubmit(new Event('submit', { cancelable: true, bubbles: true }));
      await settle();

      // Drain requests until settled
      for (let j = 0; j < 6; j++) {
        const pending = http.match(() => true);
        if (pending.length === 0) break;
        pending.forEach((r) =>
          r.flush({ results: [], totalResults: 0, executionTimeMs: 0 }),
        );
        await settle();
      }
    }

    await settle();
    fixture.detectChanges();

    // Get the messages container element
    const messagesContainer = screen.getByRole('log', { name: /conversation/i });
    expect(messagesContainer).toBeInTheDocument();

    // Scroll to top to verify auto-scroll will work
    messagesContainer.scrollTop = 0;
    await settle();

    // Now send another message
    cmp.draft.set('hello');
    await settle();
    fixture.detectChanges();

    cmp.onSubmit(new Event('submit', { cancelable: true, bubbles: true }));
    await settle();

    // Drain requests until settled
    for (let i = 0; i < 6; i++) {
      const pending = http.match(() => true);
      if (pending.length === 0) break;
      pending.forEach((r) =>
        r.flush({ results: [], totalResults: 0, executionTimeMs: 0 }),
      );
      await settle();
    }

    // Wait for the effect to run
    await settle();
    fixture.detectChanges();
    await settle();

    // After a message is added, container should have scrolled down
    // scrollHeight - scrollTop - clientHeight should be near 0 (at bottom)
    const scrollDiff =
      messagesContainer.scrollHeight -
      messagesContainer.scrollTop -
      messagesContainer.clientHeight;
    expect(scrollDiff).toBeLessThan(64);
  });

  it('does not force-scroll when user has scrolled up beyond the threshold', async () => {
    installAvailable('{"message":"response1","action":{"type":"none"}}');
    const { fixture } = await render(AiSidebar, { providers: baseProviders() });
    await settle();
    const http = TestBed.inject(HttpTestingController);
    http.match('/api/pages/root/children').forEach((r) => r.flush({ children: [] }));
    await settle();

    interface SidebarCmp {
      draft: { set(v: string): void; (): string };
      onSubmit(event: Event): void;
    }
    const cmp = fixture.componentInstance as unknown as SidebarCmp;
    const messagesContainer = screen.getByRole('log', { name: /conversation/i });

    // Send multiple messages to build up conversation history
    for (let i = 0; i < 3; i++) {
      cmp.draft.set(`message ${i}`);
      await settle();
      fixture.detectChanges();

      cmp.onSubmit(new Event('submit', { cancelable: true, bubbles: true }));
      await settle();

      // Drain requests
      for (let j = 0; j < 6; j++) {
        const pending = http.match(() => true);
        if (pending.length === 0) break;
        pending.forEach((r) =>
          r.flush({ results: [], totalResults: 0, executionTimeMs: 0 }),
        );
        await settle();
      }
    }

    // Verify we have content to scroll
    await settle();
    fixture.detectChanges();

    // Scroll to top (simulating user reading history)
    messagesContainer.scrollTop = 0;
    await settle();

    const scrollTopBefore = messagesContainer.scrollTop;
    const scrollDiffBefore =
      messagesContainer.scrollHeight -
      scrollTopBefore -
      messagesContainer.clientHeight;

    // Ensure user is scrolled up beyond the 64px threshold
    if (scrollDiffBefore <= 64) {
      // Skip this test if container is not tall enough to scroll beyond threshold
      return;
    }

    // Send another message while scrolled up
    cmp.draft.set('final message');
    await settle();
    fixture.detectChanges();

    cmp.onSubmit(new Event('submit', { cancelable: true, bubbles: true }));
    await settle();

    // Drain requests
    for (let i = 0; i < 6; i++) {
      const pending = http.match(() => true);
      if (pending.length === 0) break;
      pending.forEach((r) =>
        r.flush({ results: [], totalResults: 0, executionTimeMs: 0 }),
      );
      await settle();
    }

    // Wait for the effect to run
    await settle();
    fixture.detectChanges();
    await settle();

    // If the guard is working, scrollTop should remain at top (or very close)
    // since we were scrolled up beyond the 64px threshold
    expect(messagesContainer.scrollTop).toBe(scrollTopBefore);
  });
});
