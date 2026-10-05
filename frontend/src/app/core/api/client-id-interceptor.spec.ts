import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { clientIdInterceptor } from './client-id-interceptor';
import { clientId } from '../realtime/client-id';
import { environment } from '../../../environments/environment';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([clientIdInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return { http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController) };
}

describe('clientIdInterceptor', () => {
  const original = environment.realtimeUrl;
  afterEach(() => {
    (environment as { realtimeUrl: string }).realtimeUrl = original;
  });

  it('adds X-Client-Id to API calls when realtime is configured', () => {
    (environment as { realtimeUrl: string }).realtimeUrl = '/ws';
    const { http, ctl } = setup();
    http.get('/api/pages/x').subscribe();
    expect(ctl.expectOne('/api/pages/x').request.headers.get('X-Client-Id')).toBe(clientId());
  });

  it('sends nothing when realtime is not configured (CORS safety before the infra deploy)', () => {
    (environment as { realtimeUrl: string }).realtimeUrl = '';
    const { http, ctl } = setup();
    http.get('/api/pages/x').subscribe();
    expect(ctl.expectOne('/api/pages/x').request.headers.has('X-Client-Id')).toBe(false);
  });

  it('does not add the header to non-API (third-party) URLs', () => {
    (environment as { realtimeUrl: string }).realtimeUrl = '/ws';
    const { http, ctl } = setup();
    http.post('https://auth.example.com/oauth2/token', {}).subscribe();
    expect(
      ctl.expectOne('https://auth.example.com/oauth2/token').request.headers.has('X-Client-Id'),
    ).toBe(false);
  });

  it('clientId is stable within a tab', () => {
    expect(clientId()).toBe(clientId());
  });
});
