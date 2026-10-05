import type http from 'node:http';
import type { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { setBroadcaster } from './broadcaster.js';
import { runWithOrigin, originFromHeaders } from './request-origin.js';

/**
 * Local-only realtime: a `ws` server on `/ws` plus an in-process broadcaster.
 * Every token is accepted (this server only runs under Aspire); incoming
 * messages are ignored.
 */
export function attachRealtime(server: http.Server): { close(): Promise<void> } {
  const wss = new WebSocketServer({ server, path: '/ws' });
  setBroadcaster({
    publish: async (event) => {
      const data = JSON.stringify(event);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(data);
      }
    },
  });
  return {
    close: () =>
      new Promise<void>((resolve) => {
        setBroadcaster(null);
        for (const client of wss.clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}

/**
 * Puts X-Client-Id into AsyncLocalStorage for the rest of the request, so
 * routes that are not wrapped in withAuth (e.g. MCP) still attribute writes.
 */
export function originMiddleware(req: Request, _res: Response, next: NextFunction): void {
  void runWithOrigin(originFromHeaders(req.headers as Record<string, string | undefined>), async () => {
    next();
  });
}
