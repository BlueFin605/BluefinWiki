import { pooledAllSettled } from './pooled-all-settled';

/** A promise whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('pooledAllSettled', () => {
  it('returns results index-aligned with the input, not in completion order', async () => {
    // The rollback logic in board-view maps settled[i] back to entries[i],
    // so alignment is load-bearing, and completion order here is reversed.
    const defs = [deferred<string>(), deferred<string>(), deferred<string>()];
    const run = pooledAllSettled(defs, 3, (d) => d.promise);

    defs[2].resolve('third');
    defs[0].resolve('first');
    defs[1].reject(new Error('second failed'));

    const settled = await run;
    expect(settled.map((s) => s.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect((settled[0] as PromiseFulfilledResult<string>).value).toBe('first');
    expect((settled[2] as PromiseFulfilledResult<string>).value).toBe('third');
    expect((settled[1] as PromiseRejectedResult).reason).toEqual(new Error('second failed'));
  });

  it('never runs more than `limit` at once', async () => {
    const total = 20;
    const limit = 4;
    const defs = Array.from({ length: total }, () => deferred<number>());
    let inFlight = 0;
    let peak = 0;

    const run = pooledAllSettled(defs, limit, (d) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      return d.promise.finally(() => inFlight--);
    });

    // Settle them one at a time; the pool must refill without ever exceeding
    // the limit.
    for (let i = 0; i < total; i++) {
      defs[i].resolve(i);
      await Promise.resolve();
      await Promise.resolve();
    }

    const settled = await run;
    expect(settled).toHaveLength(total);
    expect(peak).toBeLessThanOrEqual(limit);
    expect(peak).toBe(limit);
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true);
  });

  it('starts only `limit` tasks before any settles', async () => {
    const defs = Array.from({ length: 10 }, () => deferred<void>());
    let started = 0;
    void pooledAllSettled(defs, 3, (d) => {
      started++;
      return d.promise;
    });
    await Promise.resolve();
    expect(started).toBe(3);
  });

  it('keeps going after a rejection rather than short-circuiting', async () => {
    const settled = await pooledAllSettled([1, 2, 3, 4, 5], 2, (n) =>
      n % 2 === 0 ? Promise.reject(new Error(`no ${n}`)) : Promise.resolve(n),
    );
    expect(settled.map((s) => s.status)).toEqual([
      'fulfilled', 'rejected', 'fulfilled', 'rejected', 'fulfilled',
    ]);
  });

  it('handles an empty input', async () => {
    expect(await pooledAllSettled([], 4, () => Promise.resolve(1))).toEqual([]);
  });

  it('handles fewer items than the limit', async () => {
    const settled = await pooledAllSettled([1, 2], 4, (n) => Promise.resolve(n * 10));
    expect(settled.map((s) => (s as PromiseFulfilledResult<number>).value)).toEqual([10, 20]);
  });

  it('passes the item index to the task', async () => {
    const seen: number[] = [];
    await pooledAllSettled(['a', 'b', 'c'], 2, (_item, i) => {
      seen.push(i);
      return Promise.resolve();
    });
    expect(seen.sort()).toEqual([0, 1, 2]);
  });

  it('treats a limit below 1 as 1 rather than stalling', async () => {
    const settled = await pooledAllSettled([1, 2], 0, (n) => Promise.resolve(n));
    expect(settled).toHaveLength(2);
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true);
  });
});
