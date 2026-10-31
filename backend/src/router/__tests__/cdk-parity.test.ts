import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROUTES } from '../routes.js';
import type { RouteDef } from '../types.js';
import { LAMBDA_ENTRIES } from '../../../scripts/lambda-entries.mjs';

const STACK = fileURLToPath(new URL('../../../../infrastructure/src/Infrastructure/Stacks/UnifiedStack.cs', import.meta.url));
const source = readFileSync(STACK, 'utf8');

type Explicit = { kind: 'function' | 'public' | 'apikey'; method: string; path: string; fn: string };
interface ApiNode { path: string; children: Map<string, ApiNode>; methods: Set<string>; router: boolean }

const routerPaths = [...source.matchAll(/RouteToRouter\("([^"]+)"\);/g)].map((m) => '/' + m[1]);
const explicit: Explicit[] = [...source.matchAll(/Route(ToFunction|Public|WithApiKey)\("(\w+)", "([^"]+)", (\w+)\);/g)].map((m) => ({
  kind: m[1] === 'ToFunction' ? 'function' : m[1] === 'Public' ? 'public' : 'apikey',
  method: m[2],
  path: '/' + m[3],
  fn: m[4],
}));

/** Expected wiring of every explicit API Gateway method: auth kind and the Lambda it invokes. */
const EXPECTED_EXPLICIT: Record<string, { kind: Explicit['kind']; fn: string }> = {
  'POST /auth/register': { kind: 'public', fn: 'apiRouterFunction' },
  'POST /pages/{guid}/ticket-keys/backfill': { kind: 'function', fn: 'ticketKeysBackfillFunction' },
  'POST /pages/{guid}/board-order/backfill': { kind: 'function', fn: 'boardOrderBackfillFunction' },
  'POST /admin/rebuild-page-index': { kind: 'function', fn: 'adminRebuildPageIndexFunction' },
  'POST /fetch-url': { kind: 'function', fn: 'proxyFetchUrlFunction' },
  'POST /mcp': { kind: 'apikey', fn: 'mcpFunction' },
  'GET /mcp': { kind: 'apikey', fn: 'mcpFunction' },
};
const handlers = [...source.matchAll(/Handler = \$?"([^"]+)\.handler"/g)].map((m) => m[1]);

function buildTree(): ApiNode {
  const root: ApiNode = { path: '', children: new Map(), methods: new Set(), router: false };
  const at = (p: string) => {
    let n = root;
    for (const seg of p.split('/').filter(Boolean)) {
      if (!n.children.has(seg)) n.children.set(seg, { path: `${n.path}/${seg}`, children: new Map(), methods: new Set(), router: false });
      n = n.children.get(seg)!;
    }
    return n;
  };
  for (const p of routerPaths) at(p).router = true;
  for (const e of explicit) at(e.path).methods.add(e.method);
  return root;
}

/** API Gateway REST resolution: static child, else {param} child, else {proxy+} (swallows the rest). No backtracking. */
function resolve(root: ApiNode, path: string): ApiNode | null {
  let n = root;
  for (const seg of path.split('/').filter(Boolean)) {
    const entries = [...n.children.entries()];
    const param = entries.find(([k]) => /^\{[^+]+\}$/.test(k));
    const proxy = entries.find(([k]) => /^\{.+\+\}$/.test(k));
    const stat = n.children.get(seg);
    if (stat) n = stat;
    else if (param) n = param[1];
    else if (proxy) return proxy[1];
    else return null;
  }
  return n;
}

const tree = buildTree();
const key = (m: string, p: string) => `${m} ${p}`;
const sample = (pattern: string) => pattern.replace(/\{(\w+)\}/g, 'sample-$1');
const routerCases = ROUTES.filter((r) => r.deployment === 'router').map((r) => [key(r.method, r.pattern), r] as [string, RouteDef]);
const ownCases = ROUTES.filter((r) => r.deployment === 'own-function').map((r) => [key(r.method, r.pattern), r] as [string, RouteDef]);

describe('UnifiedStack.cs <-> routes.ts parity', () => {
  it('finds the routing helpers in the stack', () => {
    expect(routerPaths.length).toBeGreaterThan(0);
    expect(explicit.length).toBeGreaterThan(0);
  });

  it('declares every API Gateway method through the four helpers', () => {
    expect(source.match(/\.AddMethod\(/g) ?? []).toHaveLength(4);
  });

  it('own-function routes in the table match the stack exactly', () => {
    const fromStack = explicit.filter((e) => e.kind !== 'public').map((e) => key(e.method, e.path)).sort();
    const fromTable = ownCases.map(([k]) => k).sort();
    expect(fromTable).toEqual(fromStack);
  });

  it('explicit routes have the expected auth kind and Lambda', () => {
    const actual = Object.fromEntries(explicit.map((e) => [key(e.method, e.path), { kind: e.kind, fn: e.fn }]));
    expect(actual).toEqual(EXPECTED_EXPLICIT);
  });

  it('the only public route is POST /auth/register, served by the router Lambda', () => {
    const publics = explicit.filter((x) => x.kind === 'public');
    expect(publics.length).toBeGreaterThan(0);
    expect(publics.map((e) => key(e.method, e.path))).toEqual(['POST /auth/register']);
    expect(publics[0].fn).toBe('apiRouterFunction');
  });

  it('public routes in the stack are router routes in the table', () => {
    const publics = explicit.filter((x) => x.kind === 'public');
    expect(publics.length).toBeGreaterThan(0);
    for (const e of publics) {
      expect(ROUTES.find((r) => r.method === e.method && r.pattern === e.path)?.deployment, key(e.method, e.path)).toBe('router');
    }
  });

  it.each(routerCases)('%s reaches the router', (_k, r) => {
    const node = resolve(tree, sample(r.pattern));
    expect(node, 'no API Gateway resource matches').not.toBeNull();
    const isPublic = explicit.some((e) => e.kind === 'public' && e.method === r.method && e.path === r.pattern);
    if (isPublic) return;
    expect(node!.router, `resolves to ${node!.path}, which has no router method`).toBe(true);
    expect(node!.methods.has(r.method), `${node!.path} sends ${r.method} to its own function`).toBe(false);
  });

  it.each(ownCases)('%s reaches its own function', (_k, r) => {
    expect(resolve(tree, sample(r.pattern))?.methods.has(r.method)).toBe(true);
  });

  it('every Handler in the stack is a bundled entry, and vice versa', () => {
    const expanded = handlers.flatMap((h) => (h.includes('{suffix}') ? ['connect', 'disconnect', 'default'].map((s) => h.replace('{suffix}', s)) : [h]));
    expect([...new Set(expanded)].sort()).toEqual([...LAMBDA_ENTRIES].sort());
  });
});
