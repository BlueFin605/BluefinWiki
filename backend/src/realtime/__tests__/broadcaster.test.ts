import { describe, it, expect, vi, afterEach } from 'vitest';
import { publishChange, setBroadcaster } from '../broadcaster.js';
import { runWithOrigin, originFromHeaders } from '../request-origin.js';

afterEach(() => setBroadcaster(null));

describe('publishChange', () => {
  it('publishes tags with the current request origin', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    await runWithOrigin('tab-1', () => publishChange(['page:g']));
    expect(publish).toHaveBeenCalledWith({ type: 'invalidate', tags: ['page:g'], origin: 'tab-1' });
  });
  it('origin is null outside a request', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    await publishChange(['page:g']);
    expect(publish.mock.calls[0][0].origin).toBeNull();
  });
  it('never throws when the broadcaster fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setBroadcaster({ publish: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(publishChange(['page:g'])).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('gives up after 1000 ms', async () => {
    vi.useFakeTimers();
    try {
      setBroadcaster({ publish: () => new Promise(() => {}) });
      const p = publishChange(['page:g']);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(p).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
  it('skips publishes for 5 s after one times out (circuit breaker)', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const publish = vi.fn(() => new Promise<void>(() => {}));
      setBroadcaster({ publish });
      const first = publishChange(['page:a']);
      await vi.advanceTimersByTimeAsync(1000);
      await first;
      expect(publish).toHaveBeenCalledTimes(1);

      // e.g. pages-reorder publishing once per sibling: 20 more publishes
      // must not each wait out the 1 s cap.
      const start = Date.now();
      for (let i = 0; i < 20; i++) await publishChange([`page:${i}`]);
      expect(Date.now() - start).toBe(0);
      expect(publish).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      void publishChange(['page:later']);
      expect(publish).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      warn.mockRestore();
    }
  });
  it('skips publishes for 5 s after one fails, and installing a broadcaster resets it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    setBroadcaster({ publish: failing });
    await publishChange(['page:a']);
    await publishChange(['page:b']);
    expect(failing).toHaveBeenCalledTimes(1);

    const ok = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish: ok });
    await publishChange(['page:c']);
    expect(ok).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it('is a no-op with no broadcaster and no tags', async () => {
    await expect(publishChange(['page:g'])).resolves.toBeUndefined();
    const publish = vi.fn();
    setBroadcaster({ publish });
    await publishChange([]);
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('originFromHeaders', () => {
  it('reads x-client-id case-insensitively and rejects junk', () => {
    expect(originFromHeaders({ 'X-Client-Id': 'abc' })).toBe('abc');
    expect(originFromHeaders({ 'x-client-id': 'abc' })).toBe('abc');
    expect(originFromHeaders({ 'x-client-id': 'x'.repeat(65) })).toBeNull();
    expect(originFromHeaders(null)).toBeNull();
  });
});
