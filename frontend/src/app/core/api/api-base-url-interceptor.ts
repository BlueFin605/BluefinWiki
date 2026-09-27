import type { HttpInterceptorFn } from '@angular/common/http';

const API_PREFIX = '/api';

/**
 * Rewrites a same-origin `/api/...` path to `${apiBaseUrl}/...`. A no-op when
 * `apiBaseUrl` is itself `/api` (dev-server proxy.conf.json already strips
 * `/api` and forwards to the local backend) or when `url` isn't `/api/*`.
 */
export function rewriteApiUrl(url: string, apiBaseUrl: string): string {
  if (!url.startsWith(API_PREFIX)) return url;
  return `${apiBaseUrl}${url.slice(API_PREFIX.length)}`;
}

/**
 * Per the ApiSubdomain convention the API lives on a sibling subdomain
 * (`api.{spa-domain}`), reached cross-origin — CloudFront does not proxy
 * `/api/*` to it (that pattern is retired). App code still calls plain
 * `/api/...` paths (matching `proxy.conf.json`'s dev-server rewrite), so this
 * must run and rewrite the URL before the request leaves the browser.
 *
 * Placed LAST in `app.config.ts`'s interceptor array: `authInterceptor`
 * decides whether to attach the auth header by checking for the `/api`
 * prefix, so it must still see the un-rewritten URL.
 */
export function apiBaseUrlInterceptor(apiBaseUrl: string): HttpInterceptorFn {
  return (req, next) => {
    const url = rewriteApiUrl(req.url, apiBaseUrl);
    return url === req.url ? next(req) : next(req.clone({ url }));
  };
}
