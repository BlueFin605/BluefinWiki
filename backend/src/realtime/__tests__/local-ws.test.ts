import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';
import express from 'express';
import WebSocket from 'ws';
import { attachRealtime, originMiddleware } from '../local-ws.js';
import { publishChange, setBroadcaster } from '../broadcaster.js';
import { BroadcastingStoragePlugin } from '../../storage/BroadcastingStoragePlugin.js';
import type { StoragePlugin } from '../../storage/StoragePlugin.js';

let server: http.Server;
let rt: { close(): Promise<void> } | undefined;
afterEach(async () => {
  await rt?.close();
  rt = undefined;
  server?.close();
  setBroadcaster(null);
});

async function listen(s: http.Server): Promise<number> {
  await new Promise<void>((r) => s.listen(0, r));
  return (s.address() as { port: number }).port;
}

describe('local realtime', () => {
  it('delivers published events to connected sockets', async () => {
    server = http.createServer();
    rt = attachRealtime(server);
    const port = await listen(server);
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=mock-jwt-token`);
    await new Promise((r) => ws.on('open', r));
    const got = new Promise<unknown>((r) => ws.on('message', (d) => r(JSON.parse(String(d)))));
    await publishChange(['page:g']);
    expect(await got).toEqual({ type: 'invalidate', tags: ['page:g'], origin: null });
    ws.close();
  });
});

describe('origin middleware', () => {
  it('keeps X-Client-Id as the origin across an await into publish(event)', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const inner = new Proxy({} as StoragePlugin, {
      get: () => vi.fn().mockResolvedValue(undefined),
    });
    const app = express();
    app.use(originMiddleware);
    app.put('/x', async (_req, res) => {
      await new Promise((r) => setTimeout(r, 5));
      await new BroadcastingStoragePlugin(inner).savePage('g', null, {} as never);
      res.json({ ok: true });
    });
    server = http.createServer(app);
    const port = await listen(server);
    const res = await fetch(`http://localhost:${port}/x`, { method: 'PUT', headers: { 'X-Client-Id': 'tab-1' } });
    expect(res.status).toBe(200);
    expect(publish).toHaveBeenCalled();
    expect(publish.mock.calls[0][0].origin).toBe('tab-1');
  });
});
