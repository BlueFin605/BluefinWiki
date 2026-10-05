import { currentOrigin } from './request-origin.js';

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
}

export function getBroadcaster(): Broadcaster {
  if (installed) return installed;
  if (fromEnv === undefined) fromEnv = createEnvBroadcaster();
  return fromEnv ?? NOOP;
}

/** Filled in by the ApiGw broadcaster task; returns null until then. */
function createEnvBroadcaster(): Broadcaster | null {
  return null;
}

const PUBLISH_TIMEOUT_MS = 1000;

/** Publish an invalidation for `tags`. Never throws; waits at most 1 s. */
export async function publishChange(tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const event: RealtimeEvent = { type: 'invalidate', tags, origin: currentOrigin() };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getBroadcaster().publish(event),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, PUBLISH_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    console.warn('realtime publish failed', err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
