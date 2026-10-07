import { AsyncLocalStorage } from 'node:async_hooks';
import { currentOrigin } from './request-origin.js';
import { ApiGwBroadcaster } from './apigw-broadcaster.js';
import { tagsForSavePage } from './change-tags.js';
import type { PageSummary } from '../types/index.js';

/** A saved page as clients see it in lists — `hasChildren` isn't known at save time. */
export type UpsertPage = Omit<PageSummary, 'hasChildren'>;

/**
 * `invalidate`: clients refetch whatever the tags cover.
 * `upsert`: clients patch these pages in place (and bump `page:<guid>` for
 * each), then invalidate any extra `tags` collected in the same batch.
 */
export type RealtimeEvent =
  | { type: 'invalidate'; tags: string[]; origin: string | null }
  | { type: 'upsert'; pages: UpsertPage[]; tags: string[]; origin: string | null };

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
 * Upper bound for an `upsert` message. API Gateway WebSocket frames cap at
 * 128 KB; past this the message falls back to the pages' coarse tags.
 */
const MAX_UPSERT_BYTES = 96 * 1024;

interface Batch {
  tags: Set<string>;
  pages: Map<string, UpsertPage>;
}

const collecting = new AsyncLocalStorage<Batch>();

/**
 * Run `fn` with publishes collected instead of sent, then send one message
 * (also when `fn` throws, for the writes that landed): an `upsert` with every
 * collected page plus the collected tags, or an `invalidate` if no page was
 * upserted. For handlers that write many pages, e.g. pages-reorder's
 * per-sibling saves.
 */
export async function collectChanges<T>(fn: () => Promise<T>): Promise<T> {
  const batch: Batch = { tags: new Set(), pages: new Map() };
  try {
    return await collecting.run(batch, fn);
  } finally {
    await send(buildEvent([...batch.pages.values()], [...batch.tags]));
  }
}

/**
 * Publish an invalidation for `tags`. Never throws; waits at most 1 s, and
 * not at all while the circuit breaker is open. Inside {@link collectChanges}
 * the tags are collected for one publish at the end instead.
 */
export async function publishChange(tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const batch = collecting.getStore();
  if (batch) {
    for (const t of tags) batch.tags.add(t);
    return;
  }
  await send(buildEvent([], tags));
}

/**
 * Publish a saved page's summary so clients patch it in place. Same
 * guarantees as {@link publishChange}; inside {@link collectChanges} the page
 * is collected (last save of a guid wins).
 */
export async function publishUpsert(page: UpsertPage): Promise<void> {
  const batch = collecting.getStore();
  if (batch) {
    batch.pages.set(page.guid, page);
    return;
  }
  await send(buildEvent([page], []));
}

function buildEvent(pages: UpsertPage[], tags: string[]): RealtimeEvent | null {
  const origin = currentOrigin();
  if (pages.length === 0) return tags.length ? { type: 'invalidate', tags, origin } : null;
  const upsert: RealtimeEvent = { type: 'upsert', pages, tags, origin };
  if (Buffer.byteLength(JSON.stringify(upsert)) <= MAX_UPSERT_BYTES) return upsert;
  const coarse = new Set(tags);
  for (const p of pages) for (const t of tagsForSavePage(p.guid, p.parentGuid)) coarse.add(t);
  return { type: 'invalidate', tags: [...coarse], origin };
}

async function send(event: RealtimeEvent | null): Promise<void> {
  if (!event) return;
  if (Date.now() < breakerOpenUntil) return;
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
