import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { APIGatewayProxyResult } from 'aws-lambda';

const httpsRequest = vi.hoisted(() => vi.fn());

vi.mock('../../middleware/auth.js', () => ({ withAuth: (h: unknown) => h }));
vi.mock('../ip-guard.js', () => ({
  resolvePublicAddress: async () => ({ address: '93.184.216.34' }),
}));
vi.mock('node:https', () => ({ request: httpsRequest }));

import { handler } from '../fetch-url.js';

function upstream(status: number, contentType: string | undefined, body = '') {
  httpsRequest.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: (e?: Error) => void };
    req.destroy = () => undefined;
    req.end = () => {
      const res = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string>; destroy: () => void };
      res.statusCode = status;
      res.headers = contentType === undefined ? {} : { 'content-type': contentType };
      res.destroy = () => undefined;
      cb(res);
      res.emit('data', Buffer.from(body));
      res.emit('end');
    };
    return req;
  });
}

const call = (url: string): Promise<APIGatewayProxyResult> =>
  (handler as unknown as (e: unknown) => Promise<APIGatewayProxyResult>)({
    body: JSON.stringify({ url }),
  });

describe('fetch-url upstream mapping', () => {
  beforeEach(() => httpsRequest.mockReset());

  it('maps an unsupported upstream content type to 502', async () => {
    upstream(200, 'image/png');
    const res = await call('https://example.com/a.png');
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toBe('Upstream returned unsupported content-type: image/png');
  });

  it('maps a missing upstream content type to 502', async () => {
    upstream(200, undefined);
    const res = await call('https://example.com/x');
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toContain('unknown');
  });

  it('still returns 200 for html', async () => {
    upstream(200, 'text/html', '<title>Hi</title><p>Hello</p>');
    const res = await call('https://example.com/');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).title).toBe('Hi');
  });

  it('still maps unexpected failures to 500', async () => {
    httpsRequest.mockImplementation(() => {
      const req = new EventEmitter() as EventEmitter & { end: () => void };
      req.end = () => req.emit('error', new Error('boom'));
      return req;
    });
    const res = await call('https://example.com/');
    expect(res.statusCode).toBe(500);
  });
});
