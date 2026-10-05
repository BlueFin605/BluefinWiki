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
