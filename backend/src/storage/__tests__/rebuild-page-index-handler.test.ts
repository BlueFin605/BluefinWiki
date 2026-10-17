import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// auth.ts reads its env at import time, so set it before the (hoisted) imports.
vi.hoisted(() => {
  process.env.NODE_ENV = 'development';
  process.env.USER_POOL_ID = 'local_pool';
});

vi.mock('../index.js', () => ({
  getStoragePlugin: () => ({ buildPageTree: vi.fn().mockResolvedValue([]) }),
}));
vi.mock('../PageIndexService.js', () => ({
  getAllEntries: vi.fn().mockResolvedValue([]),
  deletePageKeys: vi.fn(),
  putPageKey: vi.fn(),
}));

import { handler } from '../rebuild-page-index.js';

const ctx = {} as Context;
const event = (headers: Record<string, string>): APIGatewayProxyEvent =>
  ({ headers, requestContext: {} }) as unknown as APIGatewayProxyEvent;

describe('rebuild-page-index handler auth', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects a request with no Authorization header as 401', async () => {
    const res = await handler(event({}), ctx);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Missing authorization token' });
  });

  it('rejects an invalid token as 401', async () => {
    const res = await handler(event({ authorization: 'Bearer not-a-valid-token' }), ctx);
    expect(res.statusCode).toBe(401);
  });

  it('allows an Admin (local mock token)', async () => {
    const res = await handler(event({ authorization: 'Bearer mock-jwt-token' }), ctx);
    expect(res.statusCode).toBe(200);
  });
});
