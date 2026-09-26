import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiBaseUrlInterceptor, rewriteApiUrl } from './api-base-url-interceptor';

describe('rewriteApiUrl', () => {
  it('replaces the /api prefix with the given base URL', () => {
    expect(rewriteApiUrl('/api/pages/root/children', 'https://api.wiki.bluefin605.com')).toBe(
      'https://api.wiki.bluefin605.com/pages/root/children',
    );
  });

  it('is a no-op when the base URL is itself /api (dev proxy)', () => {
    expect(rewriteApiUrl('/api/pages/root/children', '/api')).toBe('/api/pages/root/children');
  });

  it('leaves non-/api URLs untouched', () => {
    expect(rewriteApiUrl('/assets/config.json', 'https://api.wiki.bluefin605.com')).toBe(
      '/assets/config.json',
    );
  });
});

describe('apiBaseUrlInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  function setup(apiBaseUrl: string) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor(apiBaseUrl)])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => httpMock.verify());

  it('rewrites /api/* requests to the cross-origin API base URL', () => {
    setup('https://api.wiki.bluefin605.com');
    http.get('/api/pages/root/children').subscribe();
    httpMock.expectOne('https://api.wiki.bluefin605.com/pages/root/children').flush({});
  });

  it('does not touch non-api requests', () => {
    setup('https://api.wiki.bluefin605.com');
    http.get('/assets/config.json').subscribe();
    httpMock.expectOne('/assets/config.json').flush({});
  });
});
