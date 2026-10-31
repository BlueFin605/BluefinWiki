import { describe, it, expect, vi, afterAll } from 'vitest';
import { ROUTES } from '../routes.js';
import { matchRoute } from '../match.js';

type Case = [method: string, path: string, pattern: string, params: Record<string, string>];
const cases: Case[] = [
  ['POST', '/pages', '/pages', {}],
  ['GET', '/pages/children', '/pages/children', {}],
  ['GET', '/pages/search', '/pages/search', {}],
  ['PUT', '/pages/reorder', '/pages/reorder', {}],
  ['POST', '/pages/links/resolve', '/pages/links/resolve', {}],
  ['GET', '/pages/g1', '/pages/{guid}', { guid: 'g1' }],
  ['PUT', '/pages/g1', '/pages/{guid}', { guid: 'g1' }],
  ['DELETE', '/pages/g1', '/pages/{guid}', { guid: 'g1' }],
  ['GET', '/pages/g1/children', '/pages/{guid}/children', { guid: 'g1' }],
  ['GET', '/pages/root/children', '/pages/{guid}/children', { guid: 'root' }],
  ['PUT', '/pages/g1/move', '/pages/{guid}/move', { guid: 'g1' }],
  ['GET', '/pages/g1/ancestors', '/pages/{guid}/ancestors', { guid: 'g1' }],
  ['GET', '/pages/g1/backlinks', '/pages/{guid}/backlinks', { guid: 'g1' }],
  ['POST', '/pages/g1/ticket-keys/backfill', '/pages/{guid}/ticket-keys/backfill', { guid: 'g1' }],
  ['POST', '/pages/g1/board-order/backfill', '/pages/{guid}/board-order/backfill', { guid: 'g1' }],
  ['POST', '/pages/g1/attachments', '/pages/{guid}/attachments', { guid: 'g1' }],
  ['GET', '/pages/g1/attachments', '/pages/{guid}/attachments', { guid: 'g1' }],
  ['POST', '/pages/g1/attachments/presign', '/pages/{guid}/attachments/presign', { guid: 'g1' }],
  ['POST', '/pages/g1/attachments/confirm', '/pages/{guid}/attachments/confirm', { guid: 'g1' }],
  ['GET', '/pages/g1/attachments/a1', '/pages/{guid}/attachments/{attachmentGuid}', { guid: 'g1', attachmentGuid: 'a1' }],
  ['DELETE', '/pages/g1/attachments/a1', '/pages/{guid}/attachments/{attachmentGuid}', { guid: 'g1', attachmentGuid: 'a1' }],
  ['GET', '/pages/g1/comments', '/pages/{guid}/comments', { guid: 'g1' }],
  ['POST', '/pages/g1/comments', '/pages/{guid}/comments', { guid: 'g1' }],
  ['PUT', '/pages/g1/comments/c1', '/pages/{guid}/comments/{commentId}', { guid: 'g1', commentId: 'c1' }],
  ['DELETE', '/pages/g1/comments/c1', '/pages/{guid}/comments/{commentId}', { guid: 'g1', commentId: 'c1' }],
  ['GET', '/ticket-keys/WE-12', '/ticket-keys/{key}', { key: 'WE-12' }],
  ['GET', '/search', '/search', {}],
  ['POST', '/fetch-url', '/fetch-url', {}],
  ['GET', '/imdb/show-details', '/imdb/show-details', {}],
  ['GET', '/tags', '/tags', {}],
  ['POST', '/tags', '/tags', {}],
  ['GET', '/page-types', '/page-types', {}],
  ['POST', '/page-types', '/page-types', {}],
  ['GET', '/page-types/t1', '/page-types/{guid}', { guid: 't1' }],
  ['PUT', '/page-types/t1', '/page-types/{guid}', { guid: 't1' }],
  ['DELETE', '/page-types/t1', '/page-types/{guid}', { guid: 't1' }],
  ['GET', '/page-types/t1/allowed-children', '/page-types/{guid}/allowed-children', { guid: 't1' }],
  ['POST', '/auth/register', '/auth/register', {}],
  ['GET', '/auth/me', '/auth/me', {}],
  ['PUT', '/auth/profile', '/auth/profile', {}],
  ['GET', '/admin/users', '/admin/users', {}],
  ['GET', '/admin/users/u1', '/admin/users/{userId}', { userId: 'u1' }],
  ['PUT', '/admin/users/u1', '/admin/users/{userId}', { userId: 'u1' }],
  ['DELETE', '/admin/users/u1', '/admin/users/{userId}', { userId: 'u1' }],
  ['POST', '/admin/users/u1/suspend', '/admin/users/{userId}/suspend', { userId: 'u1' }],
  ['POST', '/admin/users/u1/activate', '/admin/users/{userId}/activate', { userId: 'u1' }],
  ['GET', '/admin/invitations', '/admin/invitations', {}],
  ['POST', '/admin/invitations', '/admin/invitations', {}],
  ['DELETE', '/admin/invitations/ABCD1234', '/admin/invitations/{invitationCode}', { invitationCode: 'ABCD1234' }],
  ['POST', '/admin/rebuild-page-index', '/admin/rebuild-page-index', {}],
  ['POST', '/mcp', '/mcp', {}],
  ['GET', '/mcp', '/mcp', {}],
];

const key = (method: string, pattern: string) => `${method} ${pattern}`;

describe('ROUTES', () => {
  it.each(cases)('%s %s -> %s', (method, path, pattern, params) => {
    const m = matchRoute(ROUTES, method, path);
    expect(m.kind).toBe('match');
    if (m.kind === 'match') {
      expect(m.route.pattern).toBe(pattern);
      expect(m.params).toEqual(params);
    }
  });

  it('has a case above for every route', () => {
    const covered = [...new Set(cases.map(([m, , p]) => key(m, p)))].sort();
    expect(ROUTES.map((r) => key(r.method, r.pattern)).sort()).toEqual(covered);
  });

  it('has no duplicate routes', () => {
    const keys = ROUTES.map((r) => key(r.method, r.pattern));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps exactly these routes on their own Lambdas', () => {
    expect(ROUTES.filter((r) => r.deployment === 'own-function').map((r) => key(r.method, r.pattern)).sort()).toEqual([
      'GET /mcp',
      'POST /admin/rebuild-page-index',
      'POST /fetch-url',
      'POST /mcp',
      'POST /pages/{guid}/board-order/backfill',
      'POST /pages/{guid}/ticket-keys/backfill',
    ]);
    expect(ROUTES.filter((r) => r.deployment === 'router')).toHaveLength(45);
  });

  it('maps invitationCode to code for invitation revoke', () => {
    const revoke = ROUTES.find((r) => r.method === 'DELETE' && r.pattern === '/admin/invitations/{invitationCode}');
    expect(revoke?.paramAliases).toEqual({ invitationCode: 'code' });
  });

  it('loads a handler function for every route', async () => {
    vi.stubEnv('NODE_ENV', 'development'); // auth.ts skips Cognito verifier setup locally
    vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const r of ROUTES) {
      expect(typeof (await r.load()), key(r.method, r.pattern)).toBe('function');
    }
  }, 60_000);
});

afterAll(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
