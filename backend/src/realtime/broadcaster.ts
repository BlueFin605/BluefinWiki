import { currentOrigin } from './request-origin.js';
import { ApiGwBroadcaster } from './apigw-broadcaster.js';

export interface RealtimeEvent {
  type: 'invalidate';
  tags: string[];
  origin: string | null;
}

export interface Broadcaster {
  publish(event: RealtimeEvent): Promise<void>;
}

const NOOP: Broadcaster = { publish: async () => {} };
let installed: Broadcaster | null = null;
let fromEnv: Broadcaster | null | undefined;

/** Local server installs its in-process ws broadcaster; tests install fakes. */
export function setBroadcaster(b: Broadcaster | null): void {
  installed = b;
  breakerOpenUntil = 0;
}

export function getBroadcaster(): Broadcaster {
  if (installed) return installed;
  if (fromEnv === undefined) fromEnv = createEnvBroadcaster();
  return fromEnv ?? NOOP;
}

/** Deployed Lambdas get both env vars from CDK; everywhere else this is null. */
function createEnvBroadcaster(): Broadcaster | null {
  const endpoint = process.env.REALTIME_WS_ENDPOINT;
  const table = process.env.REALTIME_CONNECTIONS_TABLE;
  return endpoint && table ? new ApiGwBroadcaster(endpoint, table) : null;
}

const PUBLISH_TIMEOUT_MS = 1000;

/**
 * Circuit breaker: after a publish times out or fails, skip publishes for
 * this long. Handlers that publish once per item (pages-reorder publishes
 * once per sibling) would otherwise wait out the 1 s cap N times in a row.
 */
const BREAKER_OPEN_MS = 5000;
let breakerOpenUntil = 0;

function tripBreaker(what: 'failed' | 'timed out', detail?: unknown): void {
  breakerOpenUntil = Date.now() + BREAKER_OPEN_MS;
  console.warn(`realtime publish ${what}; skipping publishes for ${BREAKER_OPEN_MS} ms`, detail ?? '');
}

/**
 * Publish an invalidation for `tags`. Never throws; waits at most 1 s, and
 * not at all while the circuit breaker is open.
 */
export async function publishChange(tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  if (Date.now() < breakerOpenUntil) return;
  const event: RealtimeEvent = { type: 'invalidate', tags, origin: currentOrigin() };
  const TIMED_OUT = Symbol('timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      getBroadcaster().publish(event),
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), PUBLISH_TIMEOUT_MS);
      }),
    ]);
    if (result === TIMED_OUT) tripBreaker('timed out');
  } catch (err) {
    tripBreaker('failed', err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
