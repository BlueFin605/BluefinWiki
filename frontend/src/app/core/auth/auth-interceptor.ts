import type { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import {
  HttpContextToken,
  HttpErrorResponse,
  type HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { Auth } from './auth';

const API_PREFIX = '/api';

/** Set on the single retry so a second 401 does not loop back into refresh. */
export const RETRIED = new HttpContextToken<boolean>(() => false);

/**
 * Shared across concurrent 401s so they trigger exactly one token refresh.
 * Auth.refreshIdToken() also single-flights internally; this guards the
 * interceptor layer where callers each hold their own request pipeline.
 */
let refreshInFlight: Promise<string | null> | null = null;

function sharedRefresh(auth: Auth): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = auth.refreshIdToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  if (!req.url.startsWith(API_PREFIX) && !req.url.includes('/api/')) {
    return next(req);
  }

  const auth = inject(Auth);
  const token = auth.getIdToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      if (req.context.get(RETRIED)) {
        auth.signOut();
        return throwError(() => err);
      }
      return from(sharedRefresh(auth)).pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            auth.signOut();
            return throwError(() => err);
          }
          const retry = req.clone({
            setHeaders: { Authorization: `Bearer ${refreshed}` },
            context: req.context.set(RETRIED, true),
          });
          return next(retry).pipe(
            catchError((retryErr: unknown) => {
              if (retryErr instanceof HttpErrorResponse && retryErr.status === 401) {
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
