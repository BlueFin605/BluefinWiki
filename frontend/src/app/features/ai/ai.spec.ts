import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Ai } from './ai';
import { AiTools } from './ai-tools';
import type { FetchUrlResult, ImdbShowDetailsResult } from './ai-tools';

interface LanguageModelStub {
  availability: jest.Mock<Promise<string>, []>;
  create: jest.Mock;
}

interface SessionStub {
  prompt: jest.Mock<Promise<string>, [string, unknown]>;
  promptStreaming: jest.Mock;
  destroy: jest.Mock;
  inputUsage: number;
  inputQuota: number;
}

function makeSession(overrides: Partial<SessionStub> = {}): SessionStub {
  return {
    prompt: jest
      .fn<Promise<string>, [string, unknown]>()
      .mockResolvedValue('{"message":"hi","action":{"type":"none"}}'),
    promptStreaming: jest.fn(),
    destroy: jest.fn(),
    inputUsage: 100,
    inputQuota: 8000,
    ...overrides,
  };
}

function installStub(session: SessionStub): LanguageModelStub {
  const stub: LanguageModelStub = {
    availability: jest.fn<Promise<string>, []>().mockResolvedValue('available'),
    create: jest.fn().mockResolvedValue(session),
  };
  (globalThis as unknown as { LanguageModel: LanguageModelStub }).LanguageModel =
    stub;
  return stub;
}

describe('Ai service', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    delete (globalThis as unknown as { LanguageModel?: unknown }).LanguageModel;
  });

  it('isAvailable resolves to "unsupported" when LanguageModel is undefined', async () => {
    const ai = TestBed.inject(Ai);
    await expect(ai.isAvailable()).resolves.toBe('unsupported');
  });

  it('isAvailable returns the LanguageModel availability when present', async () => {
    installStub(makeSession());
    const ai = TestBed.inject(Ai);
    await expect(ai.isAvailable()).resolves.toBe('available');
  });

  it('sendMessage appends a user message and parses the assistant action', async () => {
    const session = makeSession({
      prompt: jest
        .fn<Promise<string>, [string, unknown]>()
        .mockResolvedValue(
          '{"message":"Sure","action":{"type":"update_page","pageGuid":"g","title":"New"}}',
        ),
    });
    installStub(session);
    const ai = TestBed.inject(Ai);

    await ai.sendMessage('please rename');

    const messages = ai.messages();
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.text).toBe('please rename');
    const assistant = messages.find((m) => m.role === 'assistant');
    expect(assistant?.text).toBe('Sure');
    expect(assistant?.action?.type).toBe('update_page');
    expect(ai.currentAction()?.type).toBe('update_page');
  });

  it('updates inputUsage and inputQuota signals after a turn', async () => {
    installStub(makeSession({ inputUsage: 250, inputQuota: 4096 }));
    const ai = TestBed.inject(Ai);
    await ai.sendMessage('hi');
    expect(ai.inputUsage()).toBe(250);
    expect(ai.inputQuota()).toBe(4096);
  });

  it('rejectAction clears the currentAction signal and marks the assistant message discarded', async () => {
    installStub(
      makeSession({
        prompt: jest
          .fn<Promise<string>, [string, unknown]>()
          .mockResolvedValue(
            '{"message":"Sure","action":{"type":"update_page","pageGuid":"g","title":"X"}}',
          ),
      }),
    );
    const ai = TestBed.inject(Ai);
    await ai.sendMessage('please rename');

    expect(ai.currentAction()).not.toBeNull();
    ai.rejectAction();
    expect(ai.currentAction()).toBeNull();
    const assistant = ai.messages().find((m) => m.role === 'assistant');
    expect(assistant?.actionStatus).toBe('discarded');
  });

  it('reset clears messages and usage', async () => {
    installStub(makeSession());
    const ai = TestBed.inject(Ai);
    await ai.sendMessage('hi');
    expect(ai.messages().length).toBeGreaterThan(0);
    await ai.reset();
    expect(ai.messages()).toEqual([]);
    expect(ai.inputUsage()).toBe(0);
    expect(ai.currentAction()).toBeNull();
  });

  it('beginApplyingAction flips the owning message to "applying" and returns the action without clearing currentAction', async () => {
    installStub(
      makeSession({
        prompt: jest
          .fn<Promise<string>, [string, unknown]>()
          .mockResolvedValue(
            '{"message":"Sure","action":{"type":"update_page","pageGuid":"g","title":"X"}}',
          ),
      }),
    );
    const ai = TestBed.inject(Ai);
    await ai.sendMessage('please rename');

    const action = ai.beginApplyingAction();
    expect(action?.type).toBe('update_page');
    expect(ai.currentAction()?.type).toBe('update_page');
    const assistant = ai.messages().find((m) => m.role === 'assistant');
    expect(assistant?.actionStatus).toBe('applying');
  });

  it('beginApplyingAction returns null when there is no pending action', () => {
    installStub(makeSession());
    const ai = TestBed.inject(Ai);
    expect(ai.beginApplyingAction()).toBeNull();
  });

  it('completeAction marks the message applied and clears currentAction', async () => {
    installStub(
      makeSession({
        prompt: jest
          .fn<Promise<string>, [string, unknown]>()
          .mockResolvedValue(
            '{"message":"Sure","action":{"type":"update_page","pageGuid":"g","title":"X"}}',
          ),
      }),
    );
    const ai = TestBed.inject(Ai);
    await ai.sendMessage('please rename');
    ai.beginApplyingAction();

    ai.completeAction();

    expect(ai.currentAction()).toBeNull();
    const assistant = ai.messages().find((m) => m.role === 'assistant');
    expect(assistant?.actionStatus).toBe('applied');
  });

  it('markActionFailed sets the failed status and error but leaves currentAction so the user can retry or discard', async () => {
    installStub(
      makeSession({
        prompt: jest
          .fn<Promise<string>, [string, unknown]>()
          .mockResolvedValue(
            '{"message":"Sure","action":{"type":"update_page","pageGuid":"g","title":"X"}}',
          ),
      }),
    );
    const ai = TestBed.inject(Ai);
    await ai.sendMessage('please rename');
    ai.beginApplyingAction();

    ai.markActionFailed('Server exploded');

    expect(ai.currentAction()).not.toBeNull();
    const assistant = ai.messages().find((m) => m.role === 'assistant');
    expect(assistant?.actionStatus).toBe('failed');
    expect(assistant?.actionError).toBe('Server exploded');

    // Retry: beginApplyingAction still works because currentAction survived.
    const retried = ai.beginApplyingAction();
    expect(retried?.type).toBe('update_page');
    expect(ai.messages().find((m) => m.role === 'assistant')?.actionStatus).toBe(
      'applying',
    );
  });

  it('falls back to a no-action message when the model returns invalid JSON', async () => {
    installStub(
      makeSession({
        prompt: jest
          .fn<Promise<string>, [string, unknown]>()
          .mockResolvedValue('not json at all'),
      }),
    );
    const ai = TestBed.inject(Ai);
    await ai.sendMessage('hi');
    const assistant = ai.messages().find((m) => m.role === 'assistant');
    expect(assistant?.text).toBe('not json at all');
    expect(assistant?.action).toBeUndefined();
    expect(ai.currentAction()).toBeNull();
  });
});

describe('Ai service — auto fetch-tool loop (step 7.2)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    delete (globalThis as unknown as { LanguageModel?: unknown }).LanguageModel;
  });

  it('fetch_url executes automatically: calls AiTools.fetchUrl, appends a tool row, and re-prompts the model', async () => {
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockResolvedValueOnce(
        '{"message":"Let me fetch that.","action":{"type":"fetch_url","url":"https://example.com"}}',
      )
      .mockResolvedValueOnce(
        '{"message":"Here is a summary.","action":{"type":"none"}}',
      );
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    const fetchResult: FetchUrlResult = {
      url: 'https://example.com',
      title: 'Example',
      text: 'Some content',
      contentType: 'text/html',
      truncated: false,
    };
    const fetchUrlSpy = jest.spyOn(tools, 'fetchUrl').mockResolvedValue(fetchResult);

    await ai.sendMessage('what is at https://example.com?');

    expect(fetchUrlSpy).toHaveBeenCalledWith('https://example.com');
    expect(prompt).toHaveBeenCalledTimes(2);

    const messages = ai.messages();
    expect(
      messages.some((m) => m.role === 'assistant' && m.text === 'Let me fetch that.'),
    ).toBe(true);
    const toolMsg = messages.find((m) => m.role === 'tool');
    expect(toolMsg?.text).toBe('Example');
    expect(toolMsg?.toolMeta).toEqual({
      url: 'https://example.com',
      bytes: 'Some content'.length,
      truncated: false,
    });
    const finalAssistant = messages.filter((m) => m.role === 'assistant').at(-1);
    expect(finalAssistant?.text).toBe('Here is a summary.');
    expect(ai.currentAction()).toBeNull();
  });

  it('fetch_imdb_show executes automatically via AiTools.fetchImdbShow', async () => {
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockResolvedValueOnce(
        '{"message":"Looking that up.","action":{"type":"fetch_imdb_show","showQuery":"Breaking Bad"}}',
      )
      .mockResolvedValueOnce(
        '{"message":"It has 5 seasons.","action":{"type":"none"}}',
      );
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    const imdbResult: ImdbShowDetailsResult = {
      imdbId: 'tt0903747',
      title: 'Breaking Bad',
      synopsis: 'A chemistry teacher turns to crime.',
      seasons: 5,
      url: 'https://www.imdb.com/title/tt0903747/',
    };
    const fetchImdbSpy = jest
      .spyOn(tools, 'fetchImdbShow')
      .mockResolvedValue(imdbResult);

    await ai.sendMessage('tell me about breaking bad');

    expect(fetchImdbSpy).toHaveBeenCalledWith({
      query: 'Breaking Bad',
      imdbId: undefined,
    });
    expect(prompt).toHaveBeenCalledTimes(2);
    const toolMsg = ai.messages().find((m) => m.role === 'tool');
    expect(toolMsg?.text).toBe('Breaking Bad');
    const finalAssistant = ai.messages().filter((m) => m.role === 'assistant').at(-1);
    expect(finalAssistant?.text).toBe('It has 5 seasons.');
  });

  it('caps auto-fetches at 3 per turn; the 4th proposed fetch is replaced by an anti-loop nudge, not executed', async () => {
    let call = 0;
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockImplementation(() => {
        call += 1;
        return Promise.resolve(
          `{"message":"fetching #${call}","action":{"type":"fetch_url","url":"https://example.com/${call}"}}`,
        );
      });
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    const fetchUrlSpy = jest
      .spyOn(tools, 'fetchUrl')
      .mockImplementation((url: string) =>
        Promise.resolve({
          url,
          text: 'x',
          contentType: 'text/plain',
          truncated: false,
        }),
      );

    await ai.sendMessage('keep fetching forever');

    expect(fetchUrlSpy).toHaveBeenCalledTimes(3);
    expect(prompt).toHaveBeenCalledTimes(4);
    const messages = ai.messages();
    expect(
      messages.some((m) => m.role === 'system' && /limit/i.test(m.text)),
    ).toBe(true);
  });

  it('detects a repeated fetch target within the same turn and nudges instead of re-fetching', async () => {
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockResolvedValueOnce(
        '{"message":"fetching","action":{"type":"fetch_url","url":"https://example.com"}}',
      )
      .mockResolvedValueOnce(
        '{"message":"fetching again","action":{"type":"fetch_url","url":"https://example.com"}}',
      )
      .mockResolvedValueOnce('{"message":"ok, done","action":{"type":"none"}}');
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    const fetchUrlSpy = jest.spyOn(tools, 'fetchUrl').mockResolvedValue({
      url: 'https://example.com',
      text: 'x',
      contentType: 'text/plain',
      truncated: false,
    });

    await ai.sendMessage('fetch that url twice');

    expect(fetchUrlSpy).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledTimes(3);
    const messages = ai.messages();
    expect(
      messages.some((m) => m.role === 'system' && /repeat/i.test(m.text)),
    ).toBe(true);
  });

  it('resets the per-turn fetch cap and dedupe set on a new user message', async () => {
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockResolvedValueOnce(
        '{"message":"fetching","action":{"type":"fetch_url","url":"https://example.com"}}',
      )
      .mockResolvedValueOnce('{"message":"done 1","action":{"type":"none"}}')
      .mockResolvedValueOnce(
        '{"message":"fetching again","action":{"type":"fetch_url","url":"https://example.com"}}',
      )
      .mockResolvedValueOnce('{"message":"done 2","action":{"type":"none"}}');
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    const fetchUrlSpy = jest.spyOn(tools, 'fetchUrl').mockResolvedValue({
      url: 'https://example.com',
      text: 'x',
      contentType: 'text/plain',
      truncated: false,
    });

    await ai.sendMessage('first turn');
    await ai.sendMessage('second turn, same url');

    expect(fetchUrlSpy).toHaveBeenCalledTimes(2);
  });

  it('surfaces a system message and stops the turn when the fetch call fails', async () => {
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockResolvedValueOnce(
        '{"message":"fetching","action":{"type":"fetch_url","url":"https://example.com"}}',
      );
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    jest.spyOn(tools, 'fetchUrl').mockRejectedValue(new Error('network down'));

    await ai.sendMessage('fetch this');

    expect(prompt).toHaveBeenCalledTimes(1);
    const messages = ai.messages();
    expect(
      messages.some((m) => m.role === 'system' && /network down/.test(m.text)),
    ).toBe(true);
    expect(ai.currentAction()).toBeNull();
  });

  // --- Regression tests: task review findings on the fetch-tool loop ---

  it('Finding 1a: clears a stale currentAction from a prior turn when the new turn hits the fetch-per-turn cap', async () => {
    let call = 0;
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockResolvedValueOnce(
        '{"message":"Sure","action":{"type":"update_page","pageGuid":"g","title":"Old pending"}}',
      )
      .mockImplementation(() => {
        call += 1;
        return Promise.resolve(
          `{"message":"fetching #${call}","action":{"type":"fetch_url","url":"https://example.com/${call}"}}`,
        );
      });
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    jest.spyOn(tools, 'fetchUrl').mockImplementation((url: string) =>
      Promise.resolve({
        url,
        text: 'x',
        contentType: 'text/plain',
        truncated: false,
      }),
    );

    // Prior turn leaves a pending create/update proposal.
    await ai.sendMessage('please rename it');
    expect(ai.currentAction()?.type).toBe('update_page');

    // New turn's fetch attempt runs into the per-turn cap — no actionable
    // proposal comes out of it, so the stale pending action must be cleared.
    await ai.sendMessage('keep fetching forever');

    expect(ai.currentAction()).toBeNull();
    // beginApplyingAction must not resurrect the stale card either.
    expect(ai.beginApplyingAction()).toBeNull();
  });

  it('Finding 1b: clears a stale currentAction from a prior turn when the new turn breaks on a fetch error', async () => {
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockResolvedValueOnce(
        '{"message":"Sure","action":{"type":"update_page","pageGuid":"g","title":"Old pending"}}',
      )
      .mockResolvedValueOnce(
        '{"message":"fetching","action":{"type":"fetch_url","url":"https://example.com"}}',
      );
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    jest.spyOn(tools, 'fetchUrl').mockRejectedValue(new Error('network down'));

    // Prior turn leaves a pending create/update proposal.
    await ai.sendMessage('please rename it');
    expect(ai.currentAction()?.type).toBe('update_page');

    // New turn's fetch attempt breaks on a network error — no actionable
    // proposal comes out of it, so the stale pending action must be cleared.
    await ai.sendMessage('fetch this now');

    expect(ai.currentAction()).toBeNull();
    expect(ai.beginApplyingAction()).toBeNull();
  });

  it('Finding 2: bounds the loop even when the model repeatedly re-proposes an already-fetched key', async () => {
    let call = 0;
    const prompt = jest
      .fn<Promise<string>, [string, unknown]>()
      .mockImplementation(() => {
        call += 1;
        // Safety valve only: if the loop is not correctly bounded at
        // MAX_FETCHES_PER_TURN rounds, stop it after 20 rounds so the test
        // fails fast on a wrong call count instead of hanging the runner.
        if (call > 20) {
          return Promise.resolve('{"message":"giving up","action":{"type":"none"}}');
        }
        return Promise.resolve(
          '{"message":"fetching","action":{"type":"fetch_url","url":"https://example.com"}}',
        );
      });
    installStub(makeSession({ prompt }));
    const ai = TestBed.inject(Ai);
    const tools = TestBed.inject(AiTools);
    const fetchUrlSpy = jest.spyOn(tools, 'fetchUrl').mockResolvedValue({
      url: 'https://example.com',
      text: 'x',
      contentType: 'text/plain',
      truncated: false,
    });

    await ai.sendMessage('fetch that url forever');

    // The very first fetch executes for real; every re-proposal of the same
    // key after that must be treated as consuming the per-turn budget too,
    // so the loop can run at most MAX_FETCHES_PER_TURN (3) rounds — never the
    // 20-round safety valve above.
    expect(prompt).toHaveBeenCalledTimes(4);
    expect(fetchUrlSpy).toHaveBeenCalledTimes(1);
    const messages = ai.messages();
    expect(
      messages.some((m) => m.role === 'system' && /limit/i.test(m.text)),
    ).toBe(true);
  });
});
