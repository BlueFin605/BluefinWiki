/**
 * Exponential-backoff schedule for the attachment manager's list-load retry
 * (step 4.8). Pure and framework-free so it can be unit-tested in isolation and
 * reused by the retry operator in `attachment-manager.ts`.
 *
 * `nextDelay(attempt)` returns how long to wait, in milliseconds, before retry
 * number `attempt` — 1-based, so `attempt === 1` is the first retry after the
 * initial load failure. Delays double each time (1s, 2s, 4s, 8s, 16s) and are
 * clamped at {@link MAX_DELAY_MS}. Once `attempt` exceeds {@link MAX_RETRIES}
 * (10) it returns `null`, the signal to stop retrying and surface the error.
 */

/** Maximum number of automatic retries before giving up. */
export const MAX_RETRIES = 10;

/** First backoff delay; every subsequent delay doubles until the cap. */
export const BASE_DELAY_MS = 1000;

/** Upper bound on any single backoff delay. */
export const MAX_DELAY_MS = 30_000;

/**
 * Delay in ms before the given (1-based) retry attempt, or `null` when the
 * attempt is out of range (`< 1` or `> MAX_RETRIES`) — i.e. stop retrying.
 */
export function nextDelay(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_RETRIES) {
    return null;
  }
  return Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
}
