import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { localErrorHandler, localNotFoundHandler } from '../local-error-handler.js';

describe('localErrorHandler', () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = express();
    app.use(express.json({ limit: '1kb' }));
    app.post('/echo', (req, res) => res.json(req.body));
    app.get('/boom', () => {
      throw new Error('secret failure at C:/Users/dean/project/file.ts');
    });
    app.use(localNotFoundHandler);
    app.use(localErrorHandler);
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  const post = (body: string) =>
    fetch(`${base}/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

  it('returns a JSON 400 for malformed JSON with no stack or paths', async () => {
    const res = await post('{not json');
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Invalid JSON', code: 'INVALID_JSON' });
    expect(text).not.toMatch(/node_modules|\.js:|\.ts:|at /);
  });

  it('returns a JSON 413 for an oversized body', async () => {
    const res = await post(JSON.stringify({ a: 'x'.repeat(5000) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
  });

  it('returns a generic JSON 500 that leaks neither message nor stack', async () => {
    const res = await fetch(`${base}/boom`);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
    expect(text).not.toContain('secret failure');
    expect(text).not.toContain('C:');
  });

  it('returns a JSON 404 in the { error, code } shape for an unknown route', async () => {
    const res = await fetch(`${base}/no-such-route`, { method: 'POST' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Route not found', code: 'NOT_FOUND' });
  });

  it('is registered as a four-argument error handler', () => {
    expect(localErrorHandler.length).toBe(4);
  });
});
