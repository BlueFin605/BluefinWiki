import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { isApiError, type ApiError } from './api.types';
import { errorInterceptor } from './error-interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('maps 500 with body to ApiError', (done) => {
    http.get('/api/x').subscribe({
      error: (err: ApiError) => {
        expect(isApiError(err)).toBe(true);
        expect(err.status).toBe(500);
        expect(err.code).toBe('boom');
        expect(err.message).toBe('Something went wrong');
        expect(err.requestId).toBe('req-1');
        done();
      },
    });
    httpMock.expectOne('/api/x').flush(
      { code: 'boom', message: 'Something went wrong', requestId: 'req-1' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });

  it('falls back to defaults when body has no envelope', (done) => {
    http.get('/api/x').subscribe({
      error: (err: ApiError) => {
        expect(err.code).toBe('http_error');
        expect(err.status).toBe(404);
        done();
      },
    });
    httpMock.expectOne('/api/x').flush('not found', { status: 404, statusText: 'Not Found' });
  });

  it('surfaces the server message from the real backend envelope shape { error: "..." }', (done) => {
    // Every backend handler responds with `{ error: "..." }`, not `{ message: "..." }`
    // (126 occurrences across backend/src). Without falling back to `body.error`, the
    // interceptor produces the generic HttpErrorResponse text instead of this.
    http.get('/api/x').subscribe({
      error: (err: ApiError) => {
        expect(err.message).toBe('Incorrect current password');
        expect(err.status).toBe(400);
        done();
      },
    });
    httpMock
      .expectOne('/api/x')
      .flush({ error: 'Incorrect current password' }, { status: 400, statusText: 'Bad Request' });
  });
});
