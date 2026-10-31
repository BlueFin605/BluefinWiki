import { AsyncLocalStorage } from 'node:async_hooks';

const currentRoute = new AsyncLocalStorage<string>();
const LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;
const installedOn = new WeakSet<Console>();

/** Prefix every console line written during a request with its route, e.g. "[GET /pages/{guid}]". Idempotent. */
export function installRouteLogPrefix(target: Console = console): void {
  if (installedOn.has(target)) return;
  installedOn.add(target);
  for (const level of LEVELS) {
    const original = target[level].bind(target);
    target[level] = (...args: unknown[]) => {
      const route = currentRoute.getStore();
      if (route) original(`[${route}]`, ...args);
      else original(...args);
    };
  }
}

export function runInRoute<T>(routeKey: string, fn: () => Promise<T>): Promise<T> {
  return currentRoute.run(routeKey, fn);
}
