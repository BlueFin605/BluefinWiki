import { describe, it, expect, vi, afterEach } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * `auth.ts` decides local vs. deployed mode at import time, so each test
 * stubs the env and imports a fresh copy — together with the matching fresh
 * request-origin module, whose AsyncLocalStorage that copy writes to.
 */
async function loadAuth(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.resetModules();
  const { currentOrigin } = await import('../../realtime/request-origin.js');
  const { withAuth } = await import('../auth.js');
  const echoOrigin = async (): Promise<APIGatewayProxyResult> => ({
    statusCode: 200,
    body: JSON.stringify({ origin: currentOrigin() }),
  });
  return { withAuth, echoOrigin };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function event(headers: Record<string, string>, claims?: Record<string, string>): APIGatewayProxyEvent {
  return {
    headers,
    requestContext: claims ? { authorizer: { claims } } : {},
  } as unknown as APIGatewayProxyEvent;
}

const ctx = {} as Context;

describe('withAuth request origin', () => {
  it('exposes X-Client-Id as the origin when API Gateway already supplied claims', async () => {
    const { withAuth, echoOrigin } = await loadAuth({
      NODE_ENV: 'production',
      USER_POOL_ID: 'us-east-1_TestPool',
      CLIENT_ID: 'test-client',
    });
    const res = await withAuth(echoOrigin)(
      event({ 'X-Client-Id': 'tab-1' }, { sub: 'u', 'custom:role': 'Admin' }),
      ctx,
    );
    expect(JSON.parse(res.body)).toEqual({ origin: 'tab-1' });
  });

  it('exposes x-client-id as the origin when the token is verified locally', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { withAuth, echoOrigin } = await loadAuth({ NODE_ENV: 'development', USER_POOL_ID: 'local_pool' });
    const res = await withAuth(echoOrigin)(
      event({ authorization: 'Bearer mock-jwt-token', 'x-client-id': 'tab-2' }),
      ctx,
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ origin: 'tab-2' });
  });

  it('has a null origin without the header, and allows the header via CORS', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { withAuth, echoOrigin } = await loadAuth({ NODE_ENV: 'development', USER_POOL_ID: 'local_pool' });
    const res = await withAuth(echoOrigin)(event({ Authorization: 'Bearer mock-jwt-token' }), ctx);
    expect(JSON.parse(res.body)).toEqual({ origin: null });
    expect(res.headers?.['Access-Control-Allow-Headers']).toContain('X-Client-Id');
  });
});

describe('verifyIdToken', () => {
  it('accepts mock-jwt-token in local mode', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('USER_POOL_ID', 'local_pool');
    vi.resetModules();
    const { verifyIdToken } = await import('../auth.js');
    await expect(verifyIdToken('mock-jwt-token')).resolves.toMatchObject({ sub: 'local-dev-user-id' });
  });

  it('rejects a malformed token in deployed mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('USER_POOL_ID', 'us-east-1_TestPool');
    vi.stubEnv('CLIENT_ID', 'test-client');
    vi.resetModules();
    const { verifyIdToken } = await import('../auth.js');
    await expect(verifyIdToken('mock-jwt-token')).rejects.toThrow();
  });
});
