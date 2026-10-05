import {
  ErrorHandler,
  type ApplicationConfig,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth-interceptor';
import { errorInterceptor } from './core/api/error-interceptor';
import { apiBaseUrlInterceptor } from './core/api/api-base-url-interceptor';
import { clientIdInterceptor } from './core/api/client-id-interceptor';
import { GlobalErrorHandler } from './core/error/global-error-handler';
import { provideServiceWorker } from '@angular/service-worker';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // Order matters. Angular runs interceptors forward on the request path and
    // in REVERSE on the response/error path. authInterceptor must sit before
    // apiBaseUrlInterceptor on the request path so it still sees the
    // un-rewritten `/api/...` URL when deciding whether to attach the auth
    // header; on an error it sees the raw `HttpErrorResponse` (needed for its
    // 401 refresh/retry/sign-out logic) since it is innermost of the two.
    // errorInterceptor sits first so it is outermost on the error path and
    // maps whatever finally escapes into an `ApiError` for callers.
    provideHttpClient(
      withInterceptors([
        errorInterceptor,
        authInterceptor,
        clientIdInterceptor,
        apiBaseUrlInterceptor(environment.apiBaseUrl),
      ]),
    ),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
