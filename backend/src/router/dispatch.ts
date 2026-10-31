import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { matchRoute } from './match.js';
import { withRouterCors } from './cors.js';
import type { LambdaHandler, RouteDef } from './types.js';

export interface RouterOptions {
  /** Called with the route key ('GET /pages/{guid}') before the handler runs, e.g. to annotate a trace. */
  onRoute?: (routeKey: string) => void;
  /** Wraps the handler call so log lines inside it can carry the route. Default: call fn directly. */
  runInRoute?: <T>(routeKey: string, fn: () => Promise<T>) => Promise<T>;
  /** Destination of the per-request EMF/summary line. Default: console.log. */
  log?: (line: string) => void;
  now?: () => number;
}

export const METRIC_NAMESPACE = 'BlueFinWiki/Api';

function json(statusCode: number, body: unknown, extraHeaders: Record<string, string> = {}): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(body) };
}

export function createRouter(routes: readonly RouteDef[], options: RouterOptions = {}): LambdaHandler {
  const log = options.log ?? ((line: string) => console.log(line));
  const now = options.now ?? Date.now;
  const runInRoute = options.runInRoute ?? (<T>(_routeKey: string, fn: () => Promise<T>) => fn());
  const loaded = new Map<RouteDef, Promise<LambdaHandler>>();

  function load(route: RouteDef): Promise<LambdaHandler> {
    let pending = loaded.get(route);
    if (!pending) {
      pending = route.load();
      loaded.set(route, pending);
      pending.catch(() => loaded.delete(route)); // retry a failed import on the next request
    }
    return pending;
  }

  /** One line per request: a CloudWatch EMF metric (dimension Route) that doubles as the summary log. */
  function summary(routeKey: string, requestId: string, status: number, startedAt: number): void {
    log(JSON.stringify({
      _aws: {
        Timestamp: now(),
        CloudWatchMetrics: [{
          Namespace: METRIC_NAMESPACE,
          Dimensions: [['Route']],
          Metrics: [
            { Name: 'Latency', Unit: 'Milliseconds' },
            { Name: 'Requests', Unit: 'Count' },
            { Name: 'Errors5xx', Unit: 'Count' },
          ],
        }],
      },
      Route: routeKey,
      Latency: now() - startedAt,
      Requests: 1,
      Errors5xx: status >= 500 ? 1 : 0,
      requestId,
      status,
      msg: 'request complete',
    }));
  }

  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const startedAt = now();
    const method = (event.httpMethod || '').toUpperCase();
    const path = event.path || '/';
    const requestId = event.requestContext?.requestId ?? context?.awsRequestId ?? 'unknown';

    if (method === 'OPTIONS') return withRouterCors(event, { statusCode: 204, body: '' });

    const match = matchRoute(routes, method, path);
    if (match.kind === 'not-found') {
      summary('UNMATCHED', requestId, 404, startedAt);
      return withRouterCors(event, json(404, { error: 'Not Found', message: `Route ${method} ${path} not found` }));
    }
    if (match.kind === 'method-not-allowed') {
      summary('UNMATCHED', requestId, 405, startedAt);
      return withRouterCors(event, json(405, { error: 'Method Not Allowed', message: `Route ${method} ${path} not allowed` }, { Allow: match.allowed.join(',') }));
    }

    const { route, params } = match;
    const routeKey = `${route.method} ${route.pattern}`;
    const pathParameters: Record<string, string> = { ...params };
    for (const [from, to] of Object.entries(route.paramAliases ?? {})) {
      if (params[from] !== undefined) pathParameters[to] = params[from];
    }
    const shaped: APIGatewayProxyEvent = {
      ...event,
      path,
      resource: route.pattern,
      pathParameters: Object.keys(pathParameters).length > 0 ? pathParameters : null,
      requestContext: { ...event.requestContext, resourcePath: route.pattern },
    };

    options.onRoute?.(routeKey);
    let result: APIGatewayProxyResult;
    try {
      const handler = await load(route);
      result = await runInRoute(routeKey, () => handler(shaped, context));
    } catch (error) {
      // Log inside the route context so the line carries the route prefix like handler logs do.
      await runInRoute(routeKey, async () => { console.error(`Unhandled error in ${routeKey}:`, error); });
      result = withRouterCors(event, json(500, { error: 'Internal server error' }));
    }
    summary(routeKey, requestId, result.statusCode, startedAt);
    return result;
  };
}
