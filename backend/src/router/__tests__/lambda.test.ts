import { describe, it, expect, vi } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

vi.mock('../tracing.js', () => ({ annotateRoute: vi.fn() }));
vi.mock('../logging.js', () => ({
  installRouteLogPrefix: vi.fn(),
  runInRoute: vi.fn((_k: string, fn: () => Promise<unknown>) => fn()),
}));

const { handler, routes } = await import('../lambda.js');
const { installRouteLogPrefix } = await import('../logging.js');
// Snapshot now: the runner resets mock call history between tests.
const installCallsAtLoad = vi.mocked(installRouteLogPrefix).mock.calls.length;

describe('api-router Lambda entry', () => {
  it('serves only router routes', () => {
    expect(routes).toHaveLength(45);
    expect(routes.every((r) => r.deployment === 'router')).toBe(true);
  });

  it('installs the route log prefix when loaded', () => {
    expect(installCallsAtLoad).toBe(1);
  });

  it('404s a route that has its own Lambda, such as POST /mcp', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await handler({ httpMethod: 'POST', path: '/mcp', headers: {}, requestContext: { requestId: 'r' } } as unknown as APIGatewayProxyEvent, {} as Context);
    expect(res.statusCode).toBe(404);
  });
});
