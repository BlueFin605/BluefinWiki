import { describe, it, expect } from 'vitest';
import { matchRoute } from '../match.js';
import type { RouteDef } from '../types.js';

const noop = async () => async () => ({ statusCode: 200, body: '' });
const r = (method: RouteDef['method'], pattern: string): RouteDef => ({ method, pattern, deployment: 'router', load: noop });

const routes: RouteDef[] = [
  r('POST', '/pages'),
  r('GET', '/pages/{guid}'),
  r('PUT', '/pages/{guid}'),
  r('GET', '/pages/search'),
  r('POST', '/pages/links/resolve'),
  r('GET', '/pages/{guid}/children'),
  r('GET', '/page-types/{guid}'),
  r('GET', '/page-types/{guid}/allowed-children'),
  r('GET', '/pages/{guid}/attachments/{attachmentGuid}'),
];

describe('matchRoute', () => {
  it('matches a static path with no params', () => {
    const m = matchRoute(routes, 'POST', '/pages');
    expect(m.kind).toBe('match');
    if (m.kind === 'match') { expect(m.route.pattern).toBe('/pages'); expect(m.params).toEqual({}); }
  });

  it('extracts params', () => {
    const m = matchRoute(routes, 'GET', '/pages/abc');
    expect(m).toMatchObject({ kind: 'match', params: { guid: 'abc' } });
  });

  it('static segment beats a param', () => {
    const m = matchRoute(routes, 'GET', '/pages/search');
    expect(m.kind === 'match' && m.route.pattern).toBe('/pages/search');
  });

  it('matches a deeper static route under a param', () => {
    const m = matchRoute(routes, 'GET', '/page-types/t1/allowed-children');
    expect(m.kind === 'match' && m.route.pattern).toBe('/page-types/{guid}/allowed-children');
    expect(m).toMatchObject({ params: { guid: 't1' } });
  });

  it('matches a two-segment static route', () => {
    const m = matchRoute(routes, 'POST', '/pages/links/resolve');
    expect(m.kind === 'match' && m.route.pattern).toBe('/pages/links/resolve');
  });

  it('405 when the most specific path lacks the method, without falling back to the param route', () => {
    expect(matchRoute(routes, 'PUT', '/pages/search')).toEqual({ kind: 'method-not-allowed', allowed: ['GET'] });
  });

  it('405 lists every method on the path', () => {
    expect(matchRoute(routes, 'DELETE', '/pages/abc')).toEqual({ kind: 'method-not-allowed', allowed: ['GET', 'PUT'] });
  });

  it('404 for an unknown path or wrong depth', () => {
    expect(matchRoute(routes, 'GET', '/nope')).toEqual({ kind: 'not-found' });
    expect(matchRoute(routes, 'GET', '/pages/a/b/c/d')).toEqual({ kind: 'not-found' });
  });

  it('treats the method case-insensitively', () => {
    expect(matchRoute(routes, 'get', '/pages/abc').kind).toBe('match');
  });

  it('keeps params URL-encoded, as API Gateway passes them', () => {
    const m = matchRoute(routes, 'GET', '/pages/x/attachments/my%20file.png');
    expect(m).toMatchObject({ params: { guid: 'x', attachmentGuid: 'my%20file.png' } });
  });

  it('ignores a trailing slash', () => {
    expect(matchRoute(routes, 'GET', '/pages/abc/')).toMatchObject({ kind: 'match', params: { guid: 'abc' } });
  });
});
