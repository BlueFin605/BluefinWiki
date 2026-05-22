import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ApiError } from './api.types';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = err.error as Partial<ApiError> | null;
        const apiError: ApiError = {
          status: err.status,
          code: body?.code ?? 'http_error',
          message: body?.message ?? err.message ?? 'Request failed',
          requestId: body?.requestId,
        };
        return throwError(() => apiError);
      }
      return throwError(() => err);
    }),
  );
