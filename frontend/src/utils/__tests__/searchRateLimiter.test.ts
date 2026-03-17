/**
 * Unit Tests for Search Rate Limiter
 * Task 8.4: Client-side rate limiting (max 60 searches per minute)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SearchRateLimiter } from '../searchRateLimiter';

describe('SearchRateLimiter', () => {
  let limiter: SearchRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new SearchRateLimiter(5, 1000); // 5 requests per 1 second for testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('tryAcquire()', () => {
    it('should allow requests under the limit', () => {
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('should block requests over the limit', () => {
      for (let i = 0; i < 5; i++) {
        expect(limiter.tryAcquire()).toBe(true);
      }
      // 6th request should be blocked
      expect(limiter.tryAcquire()).toBe(false);
    });

    it('should allow requests again after the window expires', () => {
      for (let i = 0; i < 5; i++) {
        limiter.tryAcquire();
      }
      expect(limiter.tryAcquire()).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(1001);

      // Should be allowed again
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('should use a rolling window', () => {
      // Make 3 requests
      limiter.tryAcquire();
      limiter.tryAcquire();
      limiter.tryAcquire();

      // Advance 500ms
      vi.advanceTimersByTime(500);

      // Make 2 more (total 5 in window)
      limiter.tryAcquire();
      limiter.tryAcquire();

      // Next should be blocked
      expect(limiter.tryAcquire()).toBe(false);

      // Advance another 501ms (first 3 requests expire)
      vi.advanceTimersByTime(501);

      // Should have room for 3 more
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(false);
    });
  });

  describe('remaining()', () => {
    it('should return max requests when no requests made', () => {
      expect(limiter.remaining()).toBe(5);
    });

    it('should decrease with each request', () => {
      limiter.tryAcquire();
      expect(limiter.remaining()).toBe(4);

      limiter.tryAcquire();
      expect(limiter.remaining()).toBe(3);
    });

    it('should return 0 when limit reached', () => {
      for (let i = 0; i < 5; i++) {
        limiter.tryAcquire();
      }
      expect(limiter.remaining()).toBe(0);
    });

    it('should recover after window expires', () => {
      for (let i = 0; i < 5; i++) {
        limiter.tryAcquire();
      }
      expect(limiter.remaining()).toBe(0);

      vi.advanceTimersByTime(1001);
      expect(limiter.remaining()).toBe(5);
    });
  });

  describe('reset()', () => {
    it('should reset the limiter', () => {
      for (let i = 0; i < 5; i++) {
        limiter.tryAcquire();
      }
      expect(limiter.remaining()).toBe(0);

      limiter.reset();
      expect(limiter.remaining()).toBe(5);
      expect(limiter.tryAcquire()).toBe(true);
    });
  });

  describe('default configuration', () => {
    it('should default to 60 requests per 60 seconds', () => {
      const defaultLimiter = new SearchRateLimiter();
      expect(defaultLimiter.remaining()).toBe(60);
    });
  });
});
