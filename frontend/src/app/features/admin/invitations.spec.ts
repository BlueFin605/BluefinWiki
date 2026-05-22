import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  Invitations,
  type Invitation,
  type CreateInvitationRequest,
} from './invitations';

function invite(over: Partial<Invitation> = {}): Invitation {
  return {
    inviteCode: 'inv-1',
    role: 'Standard',
    createdBy: { userId: 'u', displayName: 'Admin' },
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-08T00:00:00Z',
    status: 'pending',
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('Invitations service', () => {
  let http: HttpTestingController;
  let invitations: Invitations;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Invitations],
    });
    http = TestBed.inject(HttpTestingController);
    invitations = TestBed.inject(Invitations);
  });

  afterEach(() => http.verify());

  it('invitationsResource GETs /api/admin/invitations and unwraps array', async () => {
    const resource = TestBed.runInInjectionContext(() => invitations.invitationsResource());
    await settle();
    const req = http.expectOne('/api/admin/invitations');
    expect(req.request.method).toBe('GET');
    req.flush({
      invitations: [invite({ inviteCode: 'a' }), invite({ inviteCode: 'b' })],
    });
    await settle();
    expect(resource.value()?.length).toBe(2);
    expect(resource.value()?.[0].inviteCode).toBe('a');
  });

  it('createInvitation POSTs to /api/admin/invitations and bumps version', async () => {
    const resource = TestBed.runInInjectionContext(() => invitations.invitationsResource());
    await settle();
    http.expectOne('/api/admin/invitations').flush({ invitations: [] });
    await settle();

    const body: CreateInvitationRequest = {
      email: 'a@b.c',
      role: 'Admin',
      expiryDays: 14,
    };
    const promise = invitations.createInvitation(body);
    await settle();
    const post = http.expectOne('/api/admin/invitations');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(body);
    post.flush(invite({ inviteCode: 'new', role: 'Admin' }));
    const created = await promise;

    expect(created.inviteCode).toBe('new');
    await settle();
    http.expectOne('/api/admin/invitations').flush({
      invitations: [invite({ inviteCode: 'new', role: 'Admin' })],
    });
    await settle();
    expect(resource.value()?.[0].inviteCode).toBe('new');
  });

  it('revokeInvitation DELETEs /api/admin/invitations/{code}', async () => {
    const promise = invitations.revokeInvitation('inv-r');
    await settle();
    const del = http.expectOne('/api/admin/invitations/inv-r');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await promise;
  });
});
