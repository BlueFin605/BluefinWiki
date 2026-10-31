import { describe, it, expect } from 'vitest';
import { installRouteLogPrefix, runInRoute } from '../logging.js';

function fakeConsole() {
  const lines: unknown[][] = [];
  const push = (...args: unknown[]) => { lines.push(args); };
  const c = { log: push, info: push, warn: push, error: push, debug: push } as unknown as Console;
  return { c, lines };
}

describe('route log prefix', () => {
  it('prefixes lines written inside runInRoute', async () => {
    const { c, lines } = fakeConsole();
    installRouteLogPrefix(c);
    await runInRoute('GET /tags', async () => { c.log('hello', 1); c.error('bad'); });
    expect(lines).toEqual([['[GET /tags]', 'hello', 1], ['[GET /tags]', 'bad']]);
  });

  it('leaves lines outside a request alone', () => {
    const { c, lines } = fakeConsole();
    installRouteLogPrefix(c);
    c.warn('boot');
    expect(lines).toEqual([['boot']]);
  });

  it('keeps the route across awaits', async () => {
    const { c, lines } = fakeConsole();
    installRouteLogPrefix(c);
    await runInRoute('PUT /pages/{guid}', async () => { await new Promise((r) => setTimeout(r, 1)); c.info('after'); });
    expect(lines).toEqual([['[PUT /pages/{guid}]', 'after']]);
  });

  it('keeps concurrent requests apart', async () => {
    const { c, lines } = fakeConsole();
    installRouteLogPrefix(c);
    const tick = () => new Promise((r) => setTimeout(r, 1));
    await Promise.all([
      runInRoute('A', async () => { await tick(); c.log('a'); }),
      runInRoute('B', async () => { c.log('b'); await tick(); c.log('b2'); }),
    ]);
    expect(lines).toContainEqual(['[A]', 'a']);
    expect(lines).toContainEqual(['[B]', 'b']);
    expect(lines).toContainEqual(['[B]', 'b2']);
  });

  it('is idempotent per console', async () => {
    const { c, lines } = fakeConsole();
    installRouteLogPrefix(c);
    installRouteLogPrefix(c);
    await runInRoute('X', async () => c.log('once'));
    expect(lines).toEqual([['[X]', 'once']]);
  });
});
