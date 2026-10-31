import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { expressAdapter, toLambdaEvent } from '../local-adapter.js';
import { createRouter } from '../router/dispatch.js';

function fakeReq(over: Record<string, unknown> = {}): Request {
  return { method: 'GET', path: '/pages/p1', headers: { origin: 'http://localhost:4200' }, query: {}, body: undefined, ip: '127.0.0.1', get: () => undefined, ...over } as unknown as Request;
}
function fakeRes() {
  const res = {
    statusCode: 0, headers: {} as Record<string, unknown>, sent: undefined as unknown,
    setHeader(k: string, v: unknown) { res.headers[k.toLowerCase()] = v; return res; },
    getHeader(k: string) { return res.headers[k.toLowerCase()]; },
    status(c: number) { res.statusCode = c; return res; },
    send(b: unknown) { res.sent = b; return res; },
    json(b: unknown) { res.sent = b; return res; },
  };
  return res;
}

afterEach(() => vi.restoreAllMocks());

describe('local adapter', () => {
  it('routes through the router with path params and sends the result', async () => {
    const h = vi.fn(async () => ({ statusCode: 201, headers: { 'X-Test': 'yes' }, body: '{"ok":true}' }));
    const router = createRouter([{ method: 'GET', pattern: '/pages/{guid}', deployment: 'router', load: async () => h }], { log: () => {} });
    const res = fakeRes();
    await expressAdapter(router)(fakeReq(), res as unknown as Response);
    expect((h.mock.calls[0][0] as unknown as APIGatewayProxyEvent).pathParameters).toEqual({ guid: 'p1' });
    expect(res.statusCode).toBe(201);
    expect(res.headers['x-test']).toBe('yes');
    expect(res.sent).toBe('{"ok":true}');
  });

  it('sends a router 404 for an unknown path', async () => {
    const res = fakeRes();
    await expressAdapter(createRouter([], { log: () => {} }))(fakeReq({ path: '/nope' }), res as unknown as Response);
    expect(res.statusCode).toBe(404);
  });

  it('turns a raw Buffer body into base64 with isBase64Encoded', () => {
    const e = toLambdaEvent(fakeReq({ method: 'POST', body: Buffer.from('foo') }));
    expect(e.body).toBe('Zm9v');
    expect(e.isBase64Encoded).toBe(true);
  });

  it('serialises a parsed JSON body', () => {
    const e = toLambdaEvent(fakeReq({ method: 'POST', body: { a: 1 } }));
    expect(e.body).toBe('{"a":1}');
    expect(e.isBase64Encoded).toBe(false);
  });

  it('leaves path params to the router and keeps the raw path', () => {
    const e = toLambdaEvent(fakeReq({ path: '/pages/p1/attachments/my%20file.png' }));
    expect(e.pathParameters).toBeNull();
    expect(e.path).toBe('/pages/p1/attachments/my%20file.png');
  });

  it('decodes a base64 result into a Buffer', async () => {
    const res = fakeRes();
    await expressAdapter(async () => ({ statusCode: 200, isBase64Encoded: true, body: 'Zm9v' }))(fakeReq(), res as unknown as Response);
    expect(Buffer.isBuffer(res.sent) && (res.sent as Buffer).toString()).toBe('foo');
  });

  it('defaults Content-Type for attachment downloads', async () => {
    const res = fakeRes();
    await expressAdapter(async () => ({ statusCode: 200, body: 'x' }))(fakeReq({ path: '/pages/p/attachments/a.bin' }), res as unknown as Response);
    expect(res.headers['content-type']).toBe('application/octet-stream');
  });

  it('500s when the handler throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = fakeRes();
    await expressAdapter(async () => { throw new Error('boom'); })(fakeReq(), res as unknown as Response);
    expect(res.statusCode).toBe(500);
    expect(res.sent).toEqual({ error: 'Internal server error', message: 'boom' });
  });
});
