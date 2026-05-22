import type { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { HttpErrorResponse, type HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, catchError, from, switchMap, throwError } from 'rxjs';
import { Auth } from './auth';

const API_PREFIX = '/api';

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
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // TODO: single-flight refresh. Concurrent 401s call refreshIdToken()
        // in parallel; share the in-flight Promise on Auth before real /api
        // traffic lands.
        return from(auth.refreshIdToken()).pipe(
          switchMap((refreshed) => {
            if (refreshed) {
              const retry = req.clone({ setHeaders: { Authorization: `Bearer ${refreshed}` } });
              return next(retry);
            }
            auth.redirectToLogin();
            return EMPTY;
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
