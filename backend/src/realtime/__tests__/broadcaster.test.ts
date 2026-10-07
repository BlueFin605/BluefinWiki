import { describe, it, expect, vi, afterEach } from 'vitest';
import { collectChanges, publishChange, publishUpsert, setBroadcaster, type UpsertPage } from '../broadcaster.js';
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

describe('collectChanges', () => {
  it('publishes the union of the tags once, after fn', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const result = await runWithOrigin('tab-1', () =>
      collectChanges(async () => {
        await publishChange(['page:a', 'children:p']);
        await publishChange(['page:b', 'children:p']);
        expect(publish).not.toHaveBeenCalled();
        return 'done';
      }),
    );
    expect(result).toBe('done');
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toEqual({
      type: 'invalidate',
      tags: ['page:a', 'children:p', 'page:b'],
      origin: 'tab-1',
    });
  });

  it('publishes nothing when fn published nothing', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    await collectChanges(async () => {});
    expect(publish).not.toHaveBeenCalled();
  });

  it('still publishes what was collected when fn throws', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    await expect(
      collectChanges(async () => {
        await publishChange(['page:a']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

const summary = (guid: string, over: Partial<UpsertPage> = {}): UpsertPage => ({
  guid,
  title: `T ${guid}`,
  parentGuid: 'p',
  status: 'published',
  createdBy: 'u',
  modifiedAt: '2026-10-07T00:00:00.000Z',
  modifiedBy: 'u',
  ...over,
});

describe('publishUpsert', () => {
  it('publishes the page summary with no extra tags and the current origin', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    await runWithOrigin('tab-1', () => publishUpsert(summary('a')));
    expect(publish).toHaveBeenCalledWith({ type: 'upsert', pages: [summary('a')], tags: [], origin: 'tab-1' });
  });

  it('falls back to coarse invalidate tags when the message would exceed 96 KB', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    await publishUpsert(summary('big', { title: 'x'.repeat(97 * 1024) }));
    const event = publish.mock.calls[0][0];
    expect(event.type).toBe('invalidate');
    expect(event.tags).toEqual(expect.arrayContaining(['page:big', 'children:p', 'children:any']));
    expect(event).not.toHaveProperty('pages');
  });

  it('respects the circuit breaker', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    setBroadcaster({ publish: failing });
    await publishUpsert(summary('a'));
    await publishUpsert(summary('b'));
    expect(failing).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('collectChanges with upserts', () => {
  it('sends one upsert carrying every collected page (pages-reorder case)', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    await runWithOrigin('tab-1', () =>
      collectChanges(async () => {
        await publishUpsert(summary('a'));
        await publishUpsert(summary('b'));
        await publishUpsert(summary('c'));
      }),
    );
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0][0];
    expect(event.type).toBe('upsert');
    expect(event.pages.map((p: UpsertPage) => p.guid)).toEqual(['a', 'b', 'c']);
    expect(event.tags).toEqual([]);
    expect(event.origin).toBe('tab-1');
  });

  it('dedupes pages by guid (last wins) and carries collected invalidate tags', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    await collectChanges(async () => {
      await publishUpsert(summary('a', { boardOrder: 1 }));
      await publishChange(['comments:a']);
      await publishUpsert(summary('a', { boardOrder: 2 }));
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toMatchObject({
      type: 'upsert',
      pages: [summary('a', { boardOrder: 2 })],
      tags: ['comments:a'],
    });
  });

  it('falls back to invalidate with the union of coarse tags when the batch is oversize', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const big = 'x'.repeat(40 * 1024);
    await collectChanges(async () => {
      await publishUpsert(summary('a', { title: big }));
      await publishUpsert(summary('b', { title: big, parentGuid: null }));
      await publishUpsert(summary('c', { title: big }));
      await publishChange(['comments:z']);
    });
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0][0];
    expect(event.type).toBe('invalidate');
    expect(event.tags).toEqual(
      expect.arrayContaining(['comments:z', 'page:a', 'page:b', 'page:c', 'children:p', 'children:root']),
    );
  });
});
