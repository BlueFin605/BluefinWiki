import { MAX_DELAY_MS, MAX_RETRIES, nextDelay } from './backoff';

describe('nextDelay (attachment list-load backoff)', () => {
  it('doubles from 1s for the first attempts', () => {
    expect(nextDelay(1)).toBe(1000);
    expect(nextDelay(2)).toBe(2000);
    expect(nextDelay(3)).toBe(4000);
    expect(nextDelay(4)).toBe(8000);
    expect(nextDelay(5)).toBe(16000);
  });

  it('clamps at 30s once the doubling would exceed the cap', () => {
    // 2 ** 5 * 1000 = 32000 -> clamped
    expect(nextDelay(6)).toBe(MAX_DELAY_MS);
    expect(nextDelay(7)).toBe(30000);
    expect(nextDelay(8)).toBe(30000);
    expect(nextDelay(9)).toBe(30000);
    expect(nextDelay(10)).toBe(30000);
  });

  it('produces exactly the documented sequence for attempts 1..10', () => {
    const seq = Array.from({ length: MAX_RETRIES }, (_, i) => nextDelay(i + 1));
    expect(seq).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000,
    ]);
  });

  it('stops signalling (returns null) after 10 attempts', () => {
    expect(nextDelay(11)).toBeNull();
    expect(nextDelay(12)).toBeNull();
    expect(nextDelay(100)).toBeNull();
  });

  it('returns null for non-positive or non-integer attempts', () => {
    expect(nextDelay(0)).toBeNull();
    expect(nextDelay(-1)).toBeNull();
    expect(nextDelay(1.5)).toBeNull();
  });
});
