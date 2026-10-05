import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TicketKeys, isTicketKey, pageRef } from './ticket-keys';

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

  it('toGuid hits HTTP once, then serves from the cache', async () => {
    const p = svc.toGuid('BGT-1');
    await settle();
    http.expectOne('/api/ticket-keys/BGT-1').flush({ key: 'BGT-1', guid: 'g1', title: 'T' });
    expect(await p).toBe('g1');
    expect(await svc.toGuid('BGT-1')).toBe('g1');
    expect(svc.guidFor('BGT-1')).toBe('g1');
    expect(svc.keyFor('g1')).toBe('BGT-1');
  });

  it('bgt-12 and BGT-12 share a cache entry', async () => {
    svc.remember('BGT-12', 'g12');
    expect(svc.guidFor('bgt-12')).toBe('g12');
    expect(await svc.toGuid(' bgt-12 ')).toBe('g12');
    expect(svc.keyFor('g12')).toBe('BGT-12');
  });

  it('does not cache a 404', async () => {
    const p1 = svc.resolve('BGT-9');
    await settle();
    http.expectOne('/api/ticket-keys/BGT-9').flush({}, { status: 404, statusText: 'Not Found' });
    expect(await p1).toBeNull();
    const p2 = svc.resolve('BGT-9');
    await settle();
    http.expectOne('/api/ticket-keys/BGT-9').flush({ key: 'BGT-9', guid: 'g9', title: 'T' });
    expect((await p2)?.guid).toBe('g9');
  });

  it('toGuid passes a non-key through without HTTP', async () => {
    const guid = '3f2a7c1e-0000-4000-8000-000000000000';
    expect(await svc.toGuid(guid)).toBe(guid);
  });

  it('toGuid resolves a key, and returns null for an unknown key', async () => {
    const p = svc.toGuid('BGT-3');
    await settle();
    http.expectOne('/api/ticket-keys/BGT-3').flush({ key: 'BGT-3', guid: 'g3', title: 'T' });
    expect(await p).toBe('g3');

    const q = svc.toGuid('NOPE-1');
    await settle();
    http.expectOne('/api/ticket-keys/NOPE-1').flush({}, { status: 404, statusText: 'Not Found' });
    expect(await q).toBeNull();
  });
});

describe('isTicketKey / pageRef', () => {
  it('matches keys in any case and rejects GUIDs and junk', () => {
    expect(isTicketKey('BGT-12')).toBe(true);
    expect(isTicketKey('bgt-12')).toBe(true);
    expect(isTicketKey('A1-1')).toBe(true);
    expect(isTicketKey('3f2a7c1e-0000-4000-8000-000000000000')).toBe(false);
    expect(isTicketKey('BGT-')).toBe(false);
    expect(isTicketKey('1BG-2')).toBe(false);
    expect(isTicketKey('BGT')).toBe(false);
  });

  it('pageRef prefers the key, else the GUID', () => {
    expect(pageRef({ guid: 'g1', ticketKey: 'BGT-1' })).toBe('BGT-1');
    expect(pageRef({ guid: 'g1' })).toBe('g1');
    expect(pageRef({ guid: 'g1', ticketKey: null })).toBe('g1');
  });
});
