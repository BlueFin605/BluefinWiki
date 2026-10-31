import type { MatchResult, RouteDef } from './types.js';

function splitPath(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0);
}

function isParam(segment: string): boolean {
  return segment.startsWith('{') && segment.endsWith('}');
}

/** Params for `pattern` against `segments`, or null when it doesn't fit. Values stay raw. */
function fit(pattern: string, segments: string[]): Record<string, string> | null {
  const parts = splitPath(pattern);
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (isParam(parts[i])) params[parts[i].slice(1, -1)] = segments[i];
    else if (parts[i] !== segments[i]) return null;
  }
  return params;
}

/** '0' per static segment, '1' per param; a smaller string is more specific (leftmost static wins). */
function specificity(pattern: string): string {
  return splitPath(pattern).map((p) => (isParam(p) ? '1' : '0')).join('');
}

/**
 * Resolve like API Gateway: most specific matching path first, then the method.
 * A matching path without that method is 405; it never falls back to a less specific path.
 */
export function matchRoute(routes: readonly RouteDef[], method: string, path: string): MatchResult {
  const segments = splitPath(path);
  let bestPattern: string | null = null;
  let bestParams: Record<string, string> = {};
  for (const route of routes) {
    const params = fit(route.pattern, segments);
    if (!params) continue;
    if (bestPattern === null || specificity(route.pattern) < specificity(bestPattern)) {
      bestPattern = route.pattern;
      bestParams = params;
    }
  }
  if (bestPattern === null) return { kind: 'not-found' };
  const samePath = routes.filter((r) => r.pattern === bestPattern);
  const route = samePath.find((r) => r.method === method.toUpperCase());
  if (!route) return { kind: 'method-not-allowed', allowed: samePath.map((r) => r.method) };
  return { kind: 'match', route, params: bestParams };
}
