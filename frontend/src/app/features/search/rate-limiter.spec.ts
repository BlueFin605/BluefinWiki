import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('allows up to `max` acquires within the window', () => {
    const limiter = new RateLimiter(60, 60_000);
    for (let i = 0; i < 60; i++) {
      expect(limiter.tryAcquire(1_000 + i)).toBe(true);
    }
  });

  it('rejects the 61st acquire within the same window', () => {
    const limiter = new RateLimiter(60, 60_000);
    for (let i = 0; i < 60; i++) limiter.tryAcquire(1_000 + i);

    expect(limiter.tryAcquire(1_000 + 60)).toBe(false);
  });

  it('allows one more once the oldest timestamp ages out of the window', () => {
    const limiter = new RateLimiter(60, 60_000);
    const start = 1_000_000;
    // Spread the 60 fills 1s apart so only the single oldest entry is near
    // the window boundary at any given moment.
    for (let i = 0; i < 60; i++) limiter.tryAcquire(start + i * 1_000);
    // Just shy of the oldest entry ageing out: still full.
    expect(limiter.tryAcquire(start + 59_999)).toBe(false);

    // The oldest recorded timestamp is `start`; once `now` reaches
    // `start + windowMs` it has aged out of the rolling window, freeing
    // exactly one slot.
    expect(limiter.tryAcquire(start + 60_000)).toBe(true);
  });

  it('rejects again immediately after the freed slot is consumed', () => {
    const limiter = new RateLimiter(60, 60_000);
    const start = 1_000_000;
    for (let i = 0; i < 60; i++) limiter.tryAcquire(start + i * 1_000);
    limiter.tryAcquire(start + 60_000); // consumes the single freed slot

    expect(limiter.tryAcquire(start + 60_000 + 1)).toBe(false);
  });

  it('keeps separate independent windows per instance', () => {
    const a = new RateLimiter(1, 60_000);
    const b = new RateLimiter(1, 60_000);

    expect(a.tryAcquire(0)).toBe(true);
    expect(b.tryAcquire(0)).toBe(true);
    expect(a.tryAcquire(1)).toBe(false);
    expect(b.tryAcquire(1)).toBe(false);
  });
});
