/**
 * Pure sliding-window rate limiter: at most `max` acquires succeed within any
 * rolling `windowMs` window. Backed by a timestamp queue.
 *
 * The caller supplies `now` on every {@link tryAcquire} call rather than the
 * limiter reading a clock itself — that's what makes it deterministically
 * unit-testable (a fake/injected clock) without real timers.
 */
export class RateLimiter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Attempts to record one acquire at `now`. Evicts timestamps that have
   * aged out of the rolling window, then admits the new one only if fewer
   * than `max` remain.
   */
  tryAcquire(now: number): boolean {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }

    if (this.timestamps.length >= this.max) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }
}
