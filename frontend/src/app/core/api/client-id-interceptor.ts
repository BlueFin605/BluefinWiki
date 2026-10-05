import type { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { clientId } from '../realtime/client-id';

/**
 * Tags API requests with this tab's id so the backend can tell the realtime
 * hub which client originated a write. Sent ONLY when `realtimeUrl` is
 * configured: it comes from the RealtimeUrl stack output, so the header can't
 * go out (and trip CORS preflight) before the CORS allow-list change deploys.
 * Must sit before apiBaseUrlInterceptor so it still sees `/api/...` URLs.
 */
export const clientIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.realtimeUrl || !req.url.startsWith('/api')) return next(req);
  return next(req.clone({ setHeaders: { 'X-Client-Id': clientId() } }));
};
