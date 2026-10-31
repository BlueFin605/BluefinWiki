import { describe, it, expect, vi, afterEach } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createRouter } from '../dispatch.js';
import type { LambdaHandler, RouteDef } from '../types.js';

const ctx = { awsRequestId: 'ctx-req' } as Context;
const quiet = { log: () => {} };

function event(method: string, path: string, extra: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: method, path, resource: '/{proxy+}', pathParameters: { proxy: path.slice(1) },
    headers: { origin: 'https://wiki.example.com' }, multiValueHeaders: {}, body: null, isBase64Encoded: false,
    queryStringParameters: null, multiValueQueryStringParameters: null, stageVariables: null,
    requestContext: { requestId: 'req-1', resourcePath: '/{proxy+}' } as unknown as APIGatewayProxyEvent['requestContext'],
    ...extra,
  };
}

function route(method: RouteDef['method'], pattern: string, handler: LambdaHandler, extra: Partial<RouteDef> = {}): RouteDef {
  return { method, pattern, deployment: 'router', load: async () => handler, ...extra };
}

const ok = (body = 'ok'): APIGatewayProxyResult => ({ statusCode: 200, body });

afterEach(() => vi.restoreAllMocks());

describe('createRouter', () => {
  it('passes matched params, resource and path to the handler, with the context', async () => {
    const h = vi.fn(async () => ok());
    const router = createRouter([route('GET', '/pages/{guid}/comments/{commentId}', h)], quiet);
    await router(event('GET', '/pages/p1/comments/c1'), ctx);
    const seen = h.mock.calls[0][0] as unknown as APIGatewayProxyEvent;
    expect(seen.pathParameters).toEqual({ guid: 'p1', commentId: 'c1' });
    expect(seen.resource).toBe('/pages/{guid}/comments/{commentId}');
    expect(seen.path).toBe('/pages/p1/comments/c1');
    expect(seen.requestContext.resourcePath).toBe('/pages/{guid}/comments/{commentId}');
    expect((h.mock.calls[0] as unknown[])[1]).toBe(ctx);
  });

  it('sets pathParameters to null for a route without params', async () => {
    const h = vi.fn(async () => ok());
    await createRouter([route('GET', '/tags', h)], quiet)(event('GET', '/tags'), ctx);
    expect((h.mock.calls[0][0] as unknown as APIGatewayProxyEvent).pathParameters).toBeNull();
  });

  it('copies aliased params', async () => {
    const h = vi.fn(async () => ok());
    const router = createRouter([route('DELETE', '/admin/invitations/{invitationCode}', h, { paramAliases: { invitationCode: 'code' } })], quiet);
    await router(event('DELETE', '/admin/invitations/ABCD1234'), ctx);
    expect((h.mock.calls[0][0] as unknown as APIGatewayProxyEvent).pathParameters).toEqual({ invitationCode: 'ABCD1234', code: 'ABCD1234' });
  });

  it('returns the handler result unchanged, including isBase64Encoded and headers', async () => {
    const result: APIGatewayProxyResult = { statusCode: 200, isBase64Encoded: true, body: 'AAEC', headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'inline' } };
    const res = await createRouter([route('GET', '/f', async () => result)], quiet)(event('GET', '/f'), ctx);
    expect(res).toBe(result);
  });

  it('passes the request body, isBase64Encoded and headers through', async () => {
    const h = vi.fn(async () => ok());
    const headers = { 'content-type': 'multipart/form-data; boundary=x', origin: 'o' };
    await createRouter([route('POST', '/pages/{guid}/attachments', h)], quiet)(event('POST', '/pages/p/attachments', { body: 'Zm9v', isBase64Encoded: true, headers }), ctx);
    const seen = h.mock.calls[0][0] as unknown as APIGatewayProxyEvent;
    expect(seen.body).toBe('Zm9v');
    expect(seen.isBase64Encoded).toBe(true);
    expect(seen.headers).toEqual(headers);
  });

  it('404 with CORS headers for an unknown route', async () => {
    const res = await createRouter([route('GET', '/tags', async () => ok())], quiet)(event('GET', '/nope'), ctx);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not Found', message: 'Route GET /nope not found' });
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://wiki.example.com');
  });

  it('405 with Allow and CORS headers for a known path with the wrong method', async () => {
    const res = await createRouter([route('GET', '/tags', async () => ok())], quiet)(event('PUT', '/tags'), ctx);
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body).error).toBe('Method Not Allowed');
    expect(res.headers?.Allow).toBe('GET');
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://wiki.example.com');
  });

  it('500 with CORS headers when the handler throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await createRouter([route('GET', '/boom', async () => { throw new Error('boom'); })], quiet)(event('GET', '/boom'), ctx);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Internal server error' });
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://wiki.example.com');
  });

  it('logs the unhandled error inside the route context', async () => {
    let inRoute = false;
    const seen: boolean[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => { seen.push(inRoute); });
    const runInRoute = async <T,>(_k: string, fn: () => Promise<T>): Promise<T> => {
      inRoute = true;
      try { return await fn(); } finally { inRoute = false; }
    };
    const router = createRouter([{ method: 'GET', pattern: '/boom', deployment: 'router', load: async () => { throw new Error('load failed'); } }], { ...quiet, runInRoute });
    expect((await router(event('GET', '/boom'), ctx)).statusCode).toBe(500);
    expect(seen).toEqual([true]);
  });

  it('500 when the handler module fails to load, then retries the import', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.fn().mockRejectedValueOnce(new Error('import failed')).mockResolvedValue(async () => ok());
    const router = createRouter([{ method: 'GET', pattern: '/x', deployment: 'router', load }], quiet);
    expect((await router(event('GET', '/x'), ctx)).statusCode).toBe(500);
    expect((await router(event('GET', '/x'), ctx)).statusCode).toBe(200);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('loads each handler once and never loads unused routes', async () => {
    const loadA = vi.fn(async () => async () => ok());
    const loadB = vi.fn(async () => async () => ok());
    const router = createRouter([
      { method: 'GET', pattern: '/a', deployment: 'router', load: loadA },
      { method: 'GET', pattern: '/b', deployment: 'router', load: loadB },
    ], quiet);
    await router(event('GET', '/a'), ctx);
    await router(event('GET', '/a'), ctx);
    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).not.toHaveBeenCalled();
  });

  it('answers OPTIONS with 204 and CORS headers without loading anything', async () => {
    const load = vi.fn();
    const res = await createRouter([{ method: 'GET', pattern: '/a', deployment: 'router', load }], quiet)(event('OPTIONS', '/a'), ctx);
    expect(res.statusCode).toBe(204);
    expect(res.headers?.['Access-Control-Allow-Methods']).toBe('GET,POST,PUT,PATCH,DELETE,OPTIONS');
    expect(load).not.toHaveBeenCalled();
  });

  it('writes one EMF summary line per request with the route', async () => {
    const lines: string[] = [];
    let t = 1000;
    const router = createRouter([route('GET', '/pages/{guid}', async () => { t += 25; return ok(); })], { log: (l) => lines.push(l), now: () => t });
    await router(event('GET', '/pages/p1'), ctx);
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]);
    expect(line).toMatchObject({ Route: 'GET /pages/{guid}', Latency: 25, Requests: 1, Errors5xx: 0, status: 200, requestId: 'req-1' });
    expect(line._aws.CloudWatchMetrics[0]).toMatchObject({ Namespace: 'BlueFinWiki/Api', Dimensions: [['Route']] });
  });

  it('counts a 500 in Errors5xx and logs unmatched requests as UNMATCHED', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const lines: string[] = [];
    const router = createRouter([route('GET', '/boom', async () => { throw new Error('x'); })], { log: (l) => lines.push(l) });
    await router(event('GET', '/boom'), ctx);
    await router(event('GET', '/nope'), ctx);
    expect(JSON.parse(lines[0])).toMatchObject({ Route: 'GET /boom', Errors5xx: 1, status: 500 });
    expect(JSON.parse(lines[1])).toMatchObject({ Route: 'UNMATCHED', status: 404 });
  });

  it('calls onRoute and runInRoute with the route key', async () => {
    const onRoute = vi.fn();
    const runInRoute = vi.fn((_k: string, fn: () => Promise<unknown>) => fn());
    const router = createRouter([route('GET', '/pages/{guid}', async () => ok())], { ...quiet, onRoute, runInRoute: runInRoute as any });
    const res = await router(event('GET', '/pages/p1'), ctx);
    expect(res.statusCode).toBe(200);
    expect(onRoute).toHaveBeenCalledWith('GET /pages/{guid}');
    expect(runInRoute.mock.calls[0][0]).toBe('GET /pages/{guid}');
  });
});
