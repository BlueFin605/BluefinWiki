import {
  aiNow,
  aiElapsedMs,
  aiDebug,
  isAiDebugEnabled,
  __resetAiDebugForTests,
} from './ai-debug';

describe('ai-debug utilities', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    window.localStorage.removeItem('aiDebug');
    window.history.replaceState({}, '', '/');
    __resetAiDebugForTests();
  });

  afterEach(() => {
    logSpy.mockRestore();
    window.localStorage.removeItem('aiDebug');
    window.history.replaceState({}, '', '/');
    __resetAiDebugForTests();
  });

  it('aiNow returns a finite number', () => {
    const t = aiNow();
    expect(typeof t).toBe('number');
    expect(Number.isFinite(t)).toBe(true);
  });

  it('aiElapsedMs returns a non-negative delta', () => {
    const start = aiNow();
    const delta = aiElapsedMs(start);
    expect(delta).toBeGreaterThanOrEqual(0);
  });

  it('logs when localStorage.aiDebug=true', () => {
    window.localStorage.setItem('aiDebug', 'true');
    __resetAiDebugForTests();
    expect(isAiDebugEnabled()).toBe(true);
    aiDebug('event-a', { x: 1 });
    expect(logSpy).toHaveBeenCalled();
  });

  it('logs when query param aiDebug=1 is present', () => {
    window.history.replaceState({}, '', '/?aiDebug=1');
    __resetAiDebugForTests();
    expect(isAiDebugEnabled()).toBe(true);
  });

  it('truncates long string values in log payloads', () => {
    window.localStorage.setItem('aiDebug', 'true');
    __resetAiDebugForTests();
    const long = 'a'.repeat(400);
    aiDebug('big-event', { huge: long });
    const lastCall = logSpy.mock.calls.at(-1) as unknown[] | undefined;
    expect(lastCall).toBeDefined();
    const payload = lastCall?.[1] as { huge: string } | undefined;
    expect(payload?.huge.length).toBeLessThanOrEqual(301);
  });
});
