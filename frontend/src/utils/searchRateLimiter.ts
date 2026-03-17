/**
 * Search Rate Limiter
 *
 * Client-side rate limiting for search queries.
 * Allows a maximum number of searches within a rolling time window.
 */

const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

export class SearchRateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = DEFAULT_MAX_REQUESTS, windowMs = DEFAULT_WINDOW_MS) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a search request is allowed.
   * Returns true if under the rate limit, false if rate limited.
   */
  tryAcquire(): boolean {
    const now = Date.now();

    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }

  /**
   * Get the number of remaining requests in the current window.
   */
  remaining(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  /**
   * Reset the rate limiter (for testing).
   */
  reset(): void {
    this.timestamps = [];
  }
}
