import {
  HttpClient,
  type HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';
import { authInterceptor, RETRIED } from './auth-interceptor';
import { errorInterceptor } from '../api/error-interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: {
    getIdToken: jest.Mock;
    getAccessToken: jest.Mock;
    refreshIdToken: jest.Mock;
    redirectToLogin: jest.Mock;
    signOut: jest.Mock;
  };
  // The real Auth.refreshIdToken() single-flights; the stub below reproduces
  // that so tests exercise production behaviour, not interceptor-local state.
  // `refreshWork` is the underlying work that single-flighting must collapse.
  let refreshWork: jest.Mock;

  beforeEach(() => {
    let inFlight: Promise<string | null> | null = null;
    refreshWork = jest.fn().mockResolvedValue('tok-2');
    auth = {
      getIdToken: jest.fn().mockReturnValue('tok-1'),
      getAccessToken: jest.fn().mockReturnValue(null),
      refreshIdToken: jest.fn((): Promise<string | null> => {
        inFlight ??= Promise.resolve()
          .then(() => refreshWork() as Promise<string | null>)
          .finally(() => {
            inFlight = null;
          });
        return inFlight;
      }),
      redirectToLogin: jest.fn(),
      signOut: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches Bearer token to /api/* requests', () => {
    http.get('/api/pages').subscribe();
    const req = httpMock.expectOne('/api/pages');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush({});
  });

  it('falls back to the access token when there is no id token', () => {
    auth.getIdToken.mockReturnValue(null);
    (auth as unknown as { getAccessToken: jest.Mock }).getAccessToken = jest.fn().mockReturnValue('acc-1');
    http.get('/api/pages').subscribe();
    const req = httpMock.expectOne('/api/pages');
    expect(req.request.headers.get('Authorization')).toBe('Bearer acc-1');
    req.flush({});
  });

  it('sends no Authorization header when neither token exists', () => {
    auth.getIdToken.mockReturnValue(null);
    (auth as unknown as { getAccessToken: jest.Mock }).getAccessToken = jest.fn().mockReturnValue(null);
    http.get('/api/pages').subscribe();
    const req = httpMock.expectOne('/api/pages');
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });

  it('does not touch non-api requests', () => {
    http.get('/assets/config.json').subscribe();
    const req = httpMock.expectOne('/assets/config.json');
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });

  it('shares one in-flight refresh across two concurrent 401s and retries each once', (done) => {
    let done1 = false;
    let done2 = false;
    const finish = () => {
      if (done1 && done2) {
        // Both pipelines asked Auth to refresh, but the single-flight in
        // refreshIdToken() collapsed them into one actual refresh.
        expect(refreshWork).toHaveBeenCalledTimes(1);
        done();
      }
    };
    http.get('/api/a').subscribe(() => {
      done1 = true;
      finish();
    });
    http.get('/api/b').subscribe(() => {
      done2 = true;
      finish();
    });

    httpMock.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/b').flush({}, { status: 401, statusText: 'Unauthorized' });

    setTimeout(() => {
      httpMock.expectOne('/api/a').flush({});
      httpMock.expectOne('/api/b').flush({});
    }, 0);
  });

  it('signs out and propagates the error when the retried request 401s again', (done) => {
    http.get('/api/pages').subscribe({
      error: (err: HttpErrorResponse) => {
        expect(auth.signOut).toHaveBeenCalledTimes(1);
        expect(err.status).toBe(401);
        expect(auth.refreshIdToken).toHaveBeenCalledTimes(1);
        done();
      },
    });
    httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
    setTimeout(() => {
      httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
    }, 0);
  });

  it('signs out per failing pipeline and propagates 401 when concurrent retried requests 401 again', (done) => {
    let err1: HttpErrorResponse | undefined;
    let err2: HttpErrorResponse | undefined;
    const finish = () => {
      if (err1 && err2) {
        expect(err1.status).toBe(401);
        expect(err2.status).toBe(401);
        // One shared refresh...
        expect(refreshWork).toHaveBeenCalledTimes(1);
        // ...but signOut runs once per failing retry pipeline (2 here). That is
        // safe: Auth.signOut() is idempotent and does not redirect, so there is
        // no module-global dedupe flag in the interceptor.
        expect(auth.signOut).toHaveBeenCalledTimes(2);
        done();
      }
    };
    http.get('/api/a').subscribe({
      error: (e: HttpErrorResponse) => {
        err1 = e;
        finish();
      },
    });
    http.get('/api/b').subscribe({
      error: (e: HttpErrorResponse) => {
        err2 = e;
        finish();
      },
    });

    httpMock.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/b').flush({}, { status: 401, statusText: 'Unauthorized' });

    setTimeout(() => {
      httpMock.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
      httpMock.expectOne('/api/b').flush({}, { status: 401, statusText: 'Unauthorized' });
    }, 0);
  });

  it('signs out and propagates a 401 when refresh returns null', (done) => {
    auth.refreshIdToken.mockResolvedValueOnce(null);
    http.get('/api/pages').subscribe({
      error: (err: HttpErrorResponse) => {
        expect(auth.signOut).toHaveBeenCalledTimes(1);
        expect(err.status).toBe(401);
        done();
      },
    });
    httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
  });

  it('gives the retry a fresh context — the original req.context stays RETRIED=false', (done) => {
    http.get('/api/pages').subscribe(() => {
      done();
    });
    const first = httpMock.expectOne('/api/pages');
    first.flush({}, { status: 401, statusText: 'Unauthorized' });
    setTimeout(() => {
      const retried = httpMock.expectOne('/api/pages');
      // The retry carries the marker...
      expect(retried.request.context.get(RETRIED)).toBe(true);
      // ...but the original request's context (shared by clone) is untouched.
      expect(first.request.context.get(RETRIED)).toBe(false);
      retried.flush({});
    }, 0);
  });
});

/**
 * Pins the PRODUCTION interceptor registration order. app.config.ts registers
 * `withInterceptors([errorInterceptor, authInterceptor])` so that on the error
 * path (which Angular runs in reverse) authInterceptor sees the raw
 * HttpErrorResponse and errorInterceptor maps whatever finally escapes into an
 * ApiError. Under the old `[authInterceptor, errorInterceptor]` order the
 * refresh/retry/sign-out path below was dead: errorInterceptor converted the
 * 401 to a plain object first, so `err instanceof HttpErrorResponse` was false
 * and authInterceptor rethrew immediately — refreshIdToken/signOut call counts
 * asserted here would all be 0.
 */
describe('authInterceptor (production interceptor chain order)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: {
    getIdToken: jest.Mock;
    getAccessToken: jest.Mock;
    refreshIdToken: jest.Mock;
    redirectToLogin: jest.Mock;
    signOut: jest.Mock;
  };

  beforeEach(() => {
    auth = {
      getIdToken: jest.fn().mockReturnValue('tok-1'),
      getAccessToken: jest.fn().mockReturnValue(null),
      refreshIdToken: jest.fn().mockResolvedValue('tok-2'),
      redirectToLogin: jest.fn(),
      signOut: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('refreshes once and retries the request with the new token on a 401', (done) => {
    http.get('/api/pages').subscribe({
      next: (body) => {
        expect(body).toEqual({ ok: true });
        expect(auth.refreshIdToken).toHaveBeenCalledTimes(1);
        expect(auth.signOut).not.toHaveBeenCalled();
        done();
      },
      error: done,
    });
    httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
    setTimeout(() => {
      const retry = httpMock.expectOne('/api/pages');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer tok-2');
      retry.flush({ ok: true });
    }, 0);
  });

  it('signs out once and propagates when the retried request 401s again', (done) => {
    http.get('/api/pages').subscribe({
      error: (err: { status?: number }) => {
        expect(auth.refreshIdToken).toHaveBeenCalledTimes(1);
        expect(auth.signOut).toHaveBeenCalledTimes(1);
        // errorInterceptor has mapped it to an ApiError, but .status survives.
        expect(err.status).toBe(401);
        done();
      },
    });
    httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
    setTimeout(() => {
      httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
    }, 0);
  });

  it('signs out and propagates when refreshIdToken resolves null', (done) => {
    auth.refreshIdToken.mockResolvedValueOnce(null);
    http.get('/api/pages').subscribe({
      error: (err: { status?: number }) => {
        expect(auth.refreshIdToken).toHaveBeenCalledTimes(1);
        expect(auth.signOut).toHaveBeenCalledTimes(1);
        expect(err.status).toBe(401);
        done();
      },
    });
    httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
  });
});
