import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Ai } from './ai';

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
