import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ApiError } from './api.types';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        // The backend's error envelope is `{ error: "..." }` everywhere (not
        // `{ message: "..." }`), so `error` must be checked too, ahead of the
        // generic HttpErrorResponse text, or the server's actual reason never
        // reaches the UI.
        const body = err.error as (Partial<ApiError> & { error?: string }) | null;
        const apiError: ApiError = {
          status: err.status,
          code: body?.code ?? 'http_error',
          message: body?.message ?? body?.error ?? err.message ?? 'Request failed',
          requestId: body?.requestId,
        };
        return throwError(() => apiError);
      }
      return throwError(() => err);
    }),
  );
