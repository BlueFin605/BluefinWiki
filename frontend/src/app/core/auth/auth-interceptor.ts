import type { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  type HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { Auth } from './auth';

const API_PREFIX = '/api';

/**
 * Set on the single retry so a second 401 does not loop back into refresh.
 * The retry clone is given a FRESH `HttpContext` carrying this token, so the
 * original request's context is never mutated (`HttpContext.set` mutates in
 * place and `HttpRequest.clone` reuses the same context object).
 *
 * Two separate guards read this token and BOTH must stay:
 *  - the top-level `catchError` check guards a full interceptor-chain
 *    re-dispatch of an already-retried request (forward-compat for Tasks 3/6,
 *    which add interceptors that may re-enter this one);
 *  - the nested `catchError` on `next(retry)` handles the live, same-pipeline
 *    retry, whose 401 never re-enters the outer `catchError`.
 * They cover different code paths -- neither is dead nor a duplicate.
 */
export const RETRIED = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  if (!req.url.startsWith(API_PREFIX) && !req.url.includes('/api/')) {
    return next(req);
  }

  const auth = inject(Auth);
  const token = auth.getIdToken() ?? auth.getAccessToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      // Already-retried request arriving via a fresh interceptor-chain dispatch
      // (not the same-pipeline retry below). Give up.
      if (req.context.get(RETRIED)) {
        auth.signOut();
        return throwError(() => err);
      }
      // Auth.refreshIdToken() single-flights internally, so concurrent 401s
      // from the providedIn:'root' singleton share one in-flight refresh.
      return from(auth.refreshIdToken()).pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            auth.signOut();
            return throwError(() => err);
          }
          const retry = req.clone({
            setHeaders: { Authorization: `Bearer ${refreshed}` },
            context: new HttpContext().set(RETRIED, true),
          });
          return next(retry).pipe(
            catchError((retryErr: unknown) => {
              if (retryErr instanceof HttpErrorResponse && retryErr.status === 401) {
                // Same-pipeline retry still 401'd. Under concurrent retry
                // failures this runs once per failing pipeline; that is safe
                // because Auth.signOut() is idempotent and does not redirect.
                auth.signOut();
              }
              return throwError(() => retryErr);
            }),
          );
        }),
      );
    }),
  );
};
