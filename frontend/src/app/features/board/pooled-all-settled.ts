/**
 * `Promise.allSettled` with a cap on how many tasks are in flight at once.
 *
 * ## Why this exists
 *
 * A card drop can need one `PUT /pages/{guid}` per card in the column: the
 * `renumberColumn` fallback in `compute-board-order.ts` renumbers the whole
 * column. Issued through a bare `Promise.allSettled` that is 30-50
 * simultaneous requests, each landing on its own cold Lambda.
 *
 * This AWS account's Lambda limit is 50 *concurrent executions*, so a burst
 * that size pins the account ceiling, Lambda throttles the overflow, and API
 * Gateway maps the throttle to a bare `500` — with nothing in the function's
 * log, because the function is never invoked. Capping in-flight requests
 * keeps a renumber inside the ceiling, so it degrades to merely slow instead
 * of failing.
 *
 * Results stay **index-aligned with the input**, exactly like
 * `Promise.allSettled`: callers map `settled[i]` back to their own `i`th item
 * (board-view's rollback does), so completion order must not leak into the
 * result order.
 *
 * Like `allSettled` and unlike `all`, a rejection never short-circuits — every
 * task runs.
 */
export async function pooledAllSettled<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  // A limit of 0 or less would stall forever; one at a time is the only
  // sensible reading of "no concurrency".
  const width = Math.min(Math.max(1, Math.floor(limit)), items.length);

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await task(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: width }, () => worker()));
  return results;
}
