import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../mcp-handler.js';

function event(httpMethod: string, body?: unknown): APIGatewayProxyEvent {
  return {
    httpMethod,
    path: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: body === undefined ? null : JSON.stringify(body),
    queryStringParameters: null,
    pathParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    isBase64Encoded: false,
    resource: '/mcp',
    // Only the fields the handler reads matter.
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
  };
}

/**
 * Fails the test rather than hanging the suite if the handler never settles —
 * which is the exact production defect these tests guard
 * (`Runtime.NodeJsExit: ...a Promise that was never settled`).
 */
async function invoke(httpMethod: string, body?: unknown) {
  let timer: NodeJS.Timeout | undefined;
  const neverSettles = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('handler promise never settled')), 2000);
  });
  try {
    return await Promise.race([handler(event(httpMethod, body)), neverSettles]);
  } finally {
    clearTimeout(timer);
  }
}

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  },
};

describe('mcp handler HTTP methods', () => {
  it('rejects GET with 405 instead of hanging on an SSE stream it cannot serve', async () => {
    // A GET on the MCP endpoint is the client opening the standalone
    // server-to-client SSE stream. The transport holds that stream open and
    // never produces a Response, so in Lambda the invocation never settles,
    // the runtime reports Runtime.NodeJsExit and the container is killed —
    // forcing a cold start on the next MCP call.
    const result = await invoke('GET');

    expect(result.statusCode).toBe(405);
    expect(result.headers?.Allow).toBe('POST, DELETE');
    const body = JSON.parse(result.body) as { error: { code: number; message: string } };
    expect(body.error.code).toBe(-32000);
  });

  it('still serves a POST request through the transport', async () => {
    const result = await invoke('POST', INITIALIZE);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as { id: number; result: { serverInfo: { name: string } } };
    expect(body.id).toBe(1);
    expect(body.result.serverInfo.name).toBe('bluefinwiki');
  });

  it('answers a notification (no id) with 202 and an empty body', async () => {
    const result = await invoke('POST', { jsonrpc: '2.0', method: 'notifications/initialized' });

    expect(result.statusCode).toBe(202);
    expect(result.body).toBe('');
  });

  it('serves a batch mixing a notification and a request', async () => {
    const result = await invoke('POST', [
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 9, method: 'tools/list' },
    ]);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as { id: number; result: { tools: unknown[] } };
    expect(body.id).toBe(9);
    expect(body.result.tools.length).toBeGreaterThan(0);
  });

  it('still allows DELETE through the transport', async () => {
    const result = await invoke('DELETE');
    expect(result.statusCode).toBe(200);
  });

  it('reports a malformed POST body as a JSON-RPC parse error', async () => {
    const result = await invoke('POST');
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body) as { error: { code: number } };
    expect(body.error.code).toBe(-32700);
  });
});
