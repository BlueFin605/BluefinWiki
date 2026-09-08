import {
  HttpClient,
  type HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: {
    getIdToken: jest.Mock;
    refreshIdToken: jest.Mock;
    redirectToLogin: jest.Mock;
    signOut: jest.Mock;
  };

  beforeEach(() => {
    auth = {
      getIdToken: jest.fn().mockReturnValue('tok-1'),
      refreshIdToken: jest.fn().mockResolvedValue('tok-2'),
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

  it('does not touch non-api requests', () => {
    http.get('/assets/config.json').subscribe();
    const req = httpMock.expectOne('/assets/config.json');
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });

  it('single-flights refresh across two concurrent 401s and retries each once', (done) => {
    let done1 = false;
    let done2 = false;
    const finish = () => {
      if (done1 && done2) {
        expect(auth.refreshIdToken).toHaveBeenCalledTimes(1);
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

  it('signs out and propagates when refresh returns null', (done) => {
    auth.refreshIdToken.mockResolvedValueOnce(null);
    http.get('/api/pages').subscribe({
      error: () => {
        expect(auth.signOut).toHaveBeenCalledTimes(1);
        done();
      },
    });
    httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
  });
});
