import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: { getIdToken: jest.Mock; refreshIdToken: jest.Mock; redirectToLogin: jest.Mock };

  beforeEach(() => {
    auth = {
      getIdToken: jest.fn().mockReturnValue('tok-1'),
      refreshIdToken: jest.fn().mockResolvedValue('tok-2'),
      redirectToLogin: jest.fn(),
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

  it('refreshes token and retries on 401', (done) => {
    http.get('/api/pages').subscribe({
      next: () => {
        expect(auth.refreshIdToken).toHaveBeenCalled();
        done();
      },
    });
    const req1 = httpMock.expectOne('/api/pages');
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });

    setTimeout(() => {
      const req2 = httpMock.expectOne('/api/pages');
      expect(req2.request.headers.get('Authorization')).toBe('Bearer tok-2');
      req2.flush({});
    }, 0);
  });

  it('redirects to login when refresh fails', (done) => {
    auth.refreshIdToken.mockResolvedValueOnce(null);
    http.get('/api/pages').subscribe({
      complete: () => {
        expect(auth.redirectToLogin).toHaveBeenCalled();
        done();
      },
    });
    const req1 = httpMock.expectOne('/api/pages');
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });
  });
});
