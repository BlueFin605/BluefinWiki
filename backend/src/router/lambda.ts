import { createRouter } from './dispatch.js';
import { installRouteLogPrefix, runInRoute } from './logging.js';
import { ROUTES } from './routes.js';
import { annotateRoute } from './tracing.js';

installRouteLogPrefix();

/** Routes this function serves; 'own-function' routes go straight to their own Lambda in API Gateway. */
export const routes = ROUTES.filter((r) => r.deployment === 'router');

/** Lambda entry point: Handler "router/lambda.handler" in UnifiedStack.cs. */
export const handler = createRouter(routes, { onRoute: annotateRoute, runInRoute });
