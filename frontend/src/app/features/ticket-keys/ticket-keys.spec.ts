import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TicketKeys } from './ticket-keys';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('TicketKeys service', () => {
  let http: HttpTestingController;
  let svc: TicketKeys;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), TicketKeys],
    });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(TicketKeys);
  });

  afterEach(() => http.verify());

  it('resolve GETs the trimmed, encoded key and returns the body', async () => {
    const p = svc.resolve(' BGT-1 ');
    await settle();
    const req = http.expectOne('/api/ticket-keys/BGT-1');
    expect(req.request.method).toBe('GET');
    req.flush({ key: 'BGT-1', guid: 'g1', title: 'T' });
    expect(await p).toEqual({ key: 'BGT-1', guid: 'g1', title: 'T' });
  });

  it('resolve returns null on 404', async () => {
    const p = svc.resolve('BGT-9');
    await settle();
    http.expectOne('/api/ticket-keys/BGT-9').flush({}, { status: 404, statusText: 'Not Found' });
    expect(await p).toBeNull();
  });

  it('resolve rejects on other errors', async () => {
    const p = svc.resolve('BGT-9');
    const assertion = expect(p).rejects.toBeDefined();
    await settle();
    http.expectOne('/api/ticket-keys/BGT-9').flush({}, { status: 500, statusText: 'Server Error' });
    await assertion;
  });

  it('backfill POSTs to the initiative backfill endpoint', async () => {
    const p = svc.backfill('g1');
    await settle();
    const req = http.expectOne('/api/pages/g1/ticket-keys/backfill');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ assigned: 2, repaired: 1 });
    expect(await p).toEqual({ assigned: 2, repaired: 1 });
  });
});
