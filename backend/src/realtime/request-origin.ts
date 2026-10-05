import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage<string | null>();

/** Run `fn` with the caller's client id (from `X-Client-Id`) in async context. */
export function runWithOrigin<T>(origin: string | null, fn: () => Promise<T>): Promise<T> {
  return store.run(origin, fn);
}

export function currentOrigin(): string | null {
  return store.getStore() ?? null;
}

export function originFromHeaders(headers: Record<string, string | undefined> | null | undefined): string | null {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'x-client-id');
  const v = key ? headers[key] : undefined;
  return v && v.length <= 64 ? v : null;
}
