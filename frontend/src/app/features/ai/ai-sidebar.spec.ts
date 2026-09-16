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

  // jsdom stubs Element.scrollHeight/clientHeight to a constant 0 (see
  // node_modules/jsdom/lib/jsdom/living/nodes/Element-impl.js), so these
  // tests stub realistic, non-zero values on the container directly.
  // scrollTop is left as a normal writable property — jsdom implements it
  // as a plain instance field (see the same file's constructor), so no
  // stub is needed for it.
  function stubContainerGeometry(
    container: HTMLElement,
    initial: { scrollHeight: number; clientHeight: number },
  ): { setScrollHeight(value: number): void } {
    let scrollHeight = initial.scrollHeight;
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      get: () => initial.clientHeight,
    });
    return {
      setScrollHeight(value: number) {
        scrollHeight = value;
      },
    };
  }

  interface SidebarCmp {
    draft: { set(v: string): void; (): string };
    onSubmit(event: Event): void;
  }

  async function sendMessage(
    cmp: SidebarCmp,
    fixture: { detectChanges(): void },
    http: HttpTestingController,
    text: string,
  ): Promise<void> {
    cmp.draft.set(text);
    await settle();
    fixture.detectChanges();
    cmp.onSubmit(new Event('submit', { cancelable: true, bubbles: true }));
    await settle();
    for (let i = 0; i < 6; i++) {
      const pending = http.match(() => true);
      if (pending.length === 0) break;
      pending.forEach((r) =>
        r.flush({ results: [], totalResults: 0, executionTimeMs: 0 }),
      );
      await settle();
    }
    await settle();
    fixture.detectChanges();
  }

  it('scrolls the transcript to the bottom when a new message is appended near the bottom', async () => {
    installAvailable('{"message":"response1","action":{"type":"none"}}');
    const { fixture } = await render(AiSidebar, { providers: baseProviders() });
    await settle();
    const http = TestBed.inject(HttpTestingController);
    http.match('/api/pages/root/children').forEach((r) => r.flush({ children: [] }));
    await settle();

    const cmp = fixture.componentInstance as unknown as SidebarCmp;
    const messagesContainer = screen.getByRole('log', { name: /conversation/i });

    // Prime the container at a fixed pre-append height (400px, 380px
    // viewport) and let one message run through the effect so its
    // guard/cache picks up that height.
    const geometry = stubContainerGeometry(messagesContainer, {
      scrollHeight: 400,
      clientHeight: 380,
    });
    await sendMessage(cmp, fixture, http, 'priming message');

    // Put the user 0px from the bottom of that 400px-tall content
    // (400 - 20 - 380 === 0, well under the 64px threshold) — this is the
    // state the DOM was in immediately BEFORE the next message arrives.
    messagesContainer.scrollTop = 20;

    // The next message's rendered content grows the container by 100px
    // (a realistic chat-bubble height, comfortably over the 64px guard) —
    // simulating what Angular's own change detection will have already
    // written into the DOM by the time this effect's callbacks run.
    geometry.setScrollHeight(500);

    await sendMessage(cmp, fixture, http, 'hello');

    // The user was at the bottom before this message arrived, so the
    // container must have actually scrolled to the new (larger) height —
    // not merely ended up "under 64px", which would also be true of a
    // no-op on a short container.
    expect(messagesContainer.scrollTop).toBe(500);
  });

  it('does not force-scroll when user has scrolled up beyond the threshold', async () => {
    installAvailable('{"message":"response1","action":{"type":"none"}}');
    const { fixture } = await render(AiSidebar, { providers: baseProviders() });
    await settle();
    const http = TestBed.inject(HttpTestingController);
    http.match('/api/pages/root/children').forEach((r) => r.flush({ children: [] }));
    await settle();

    const cmp = fixture.componentInstance as unknown as SidebarCmp;
    const messagesContainer = screen.getByRole('log', { name: /conversation/i });

    // Prime the container at a fixed pre-append height (1000px, 300px
    // viewport) and let one message run through the effect so its
    // guard/cache picks up that height.
    const geometry = stubContainerGeometry(messagesContainer, {
      scrollHeight: 1000,
      clientHeight: 300,
    });
    await sendMessage(cmp, fixture, http, 'priming message');

    // Scroll well up from the bottom: 1000 - 100 - 300 === 600, clearly
    // over the 64px threshold — this is the state the DOM was in
    // immediately BEFORE the next message arrives.
    messagesContainer.scrollTop = 100;
    const scrollTopBefore = messagesContainer.scrollTop;

    // The next message grows the container further, same as a real reply
    // would.
    geometry.setScrollHeight(1100);

    await sendMessage(cmp, fixture, http, 'final message');

    // The guard must have suppressed the scroll: scrollTop stays exactly
    // where the user left it, proving the effect did not touch it — not
    // merely that some assertion about it happened to hold.
    expect(messagesContainer.scrollTop).toBe(scrollTopBefore);
  });
});
