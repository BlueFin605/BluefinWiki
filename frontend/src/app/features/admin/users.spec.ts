import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Users, type UserRecord, type UpdateUserRequest } from './users';

function userRec(over: Partial<UserRecord> = {}): UserRecord {
  return {
    userId: 'u-1',
    email: 'a@b.c',
    displayName: 'Alice',
    role: 'Standard',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('Users service', () => {
  let http: HttpTestingController;
  let users: Users;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Users],
    });
    http = TestBed.inject(HttpTestingController);
    users = TestBed.inject(Users);
  });

  afterEach(() => http.verify());

  it('usersResource GETs /api/admin/users and unwraps users array', async () => {
    const resource = TestBed.runInInjectionContext(() => users.usersResource());
    await settle();
    const req = http.expectOne('/api/admin/users');
    expect(req.request.method).toBe('GET');
    req.flush({ users: [userRec({ userId: 'a' }), userRec({ userId: 'b' })] });
    await settle();
    expect(resource.value()?.length).toBe(2);
    expect(resource.value()?.[0].userId).toBe('a');
  });

  it('updateUser PUTs /api/admin/users/{id} and bumps version', async () => {
    const resource = TestBed.runInInjectionContext(() => users.usersResource());
    await settle();
    http.expectOne('/api/admin/users').flush({ users: [userRec({ userId: 'u-9' })] });
    await settle();

    const body: UpdateUserRequest = { role: 'Admin', displayName: 'Renamed' };
    const promise = users.updateUser('u-9', body);
    await settle();
    const put = http.expectOne('/api/admin/users/u-9');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(body);
    put.flush(userRec({ userId: 'u-9', role: 'Admin', displayName: 'Renamed' }));
    await promise;

    await settle();
    http
      .expectOne('/api/admin/users')
      .flush({ users: [userRec({ userId: 'u-9', role: 'Admin', displayName: 'Renamed' })] });
    await settle();
    expect(resource.value()?.[0].role).toBe('Admin');
  });

  it('suspendUser POSTs /api/admin/users/{id}/suspend and bumps version', async () => {
    const resource = TestBed.runInInjectionContext(() => users.usersResource());
    await settle();
    http.expectOne('/api/admin/users').flush({ users: [userRec({ userId: 'u-s', status: 'active' })] });
    await settle();

    const promise = users.suspendUser('u-s');
    await settle();
    const post = http.expectOne('/api/admin/users/u-s/suspend');
    expect(post.request.method).toBe('POST');
    post.flush(userRec({ userId: 'u-s', status: 'suspended' }));
    await promise;

    await settle();
    http.expectOne('/api/admin/users').flush({ users: [userRec({ userId: 'u-s', status: 'suspended' })] });
    await settle();
    expect(resource.value()?.[0].status).toBe('suspended');
  });

  it('activateUser POSTs /api/admin/users/{id}/activate', async () => {
    const promise = users.activateUser('u-a');
    await settle();
    const post = http.expectOne('/api/admin/users/u-a/activate');
    expect(post.request.method).toBe('POST');
    post.flush(userRec({ userId: 'u-a', status: 'active' }));
    await promise;
  });

  it('activateUser re-requests usersResource via the invalidation bus', async () => {
    const resource = TestBed.runInInjectionContext(() => users.usersResource());
    await settle();
    http.expectOne('/api/admin/users').flush({ users: [userRec({ userId: 'u-a', status: 'suspended' })] });
    await settle();

    const promise = users.activateUser('u-a');
    await settle();
    http.expectOne('/api/admin/users/u-a/activate').flush(userRec({ userId: 'u-a', status: 'active' }));
    await promise;
    await settle();

    http.expectOne('/api/admin/users').flush({ users: [userRec({ userId: 'u-a', status: 'active' })] });
    await settle();
    expect(resource.value()?.[0].status).toBe('active');
  });

  it('deleteUser DELETEs /api/admin/users/{id} and bumps version', async () => {
    const resource = TestBed.runInInjectionContext(() => users.usersResource());
    await settle();
    http.expectOne('/api/admin/users').flush({
      users: [userRec({ userId: 'u-x' }), userRec({ userId: 'u-y' })],
    });
    await settle();

    const promise = users.deleteUser('u-x');
    await settle();
    const del = http.expectOne('/api/admin/users/u-x');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await promise;

    await settle();
    http.expectOne('/api/admin/users').flush({ users: [userRec({ userId: 'u-y' })] });
    await settle();
    expect(resource.value()?.length).toBe(1);
    expect(resource.value()?.[0].userId).toBe('u-y');
  });
});
