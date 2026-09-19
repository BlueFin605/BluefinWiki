import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { CognitoUserPool } from 'amazon-cognito-identity-js';

import { environment } from '../../../environments/environment';
import { Auth } from './auth';
import { USER_POOL } from './cognito-config';

function fakeUserPool(overrides: Partial<CognitoUserPool> = {}): CognitoUserPool {
  return {
    getCurrentUser: () => null,
    ...overrides,
  } as unknown as CognitoUserPool;
}

/** Every TestBed module below constructs the real Auth, which now injects HttpClient. */
function httpProviders() {
  return [provideHttpClient(), provideHttpClientTesting()];
}

describe('Auth', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('with NG_APP_DISABLE_AUTH=true', () => {
    beforeEach(() => {
      environment.disableAuth = true;
      TestBed.configureTestingModule({
        providers: [...httpProviders(), { provide: USER_POOL, useValue: fakeUserPool() }],
      });
    });

    it('signs in a mock Admin on bootstrap', async () => {
      const svc = TestBed.inject(Auth);
      await Promise.resolve();
      await Promise.resolve();
      expect(svc.isAuthenticated()).toBe(true);
      expect(svc.user()?.role).toBe('Admin');
      expect(localStorage.getItem('idToken')).toBe('mock-jwt-token');
    });

    it('signOut clears tokens and user', async () => {
      const svc = TestBed.inject(Auth);
      await Promise.resolve();
      await Promise.resolve();
      svc.signOut();
      expect(svc.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('idToken')).toBeNull();
    });
  });

  describe('with real auth (disableAuth=false) and no stored token', () => {
    beforeEach(() => {
      environment.disableAuth = false;
      TestBed.configureTestingModule({
        providers: [...httpProviders(), { provide: USER_POOL, useValue: fakeUserPool() }],
      });
    });

    it('is unauthenticated on bootstrap', async () => {
      const svc = TestBed.inject(Auth);
      await Promise.resolve();
      await Promise.resolve();
      expect(svc.isAuthenticated()).toBe(false);
      expect(svc.user()).toBeNull();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      environment.disableAuth = false;
    });

    it('catches errors during bootstrap and writes _error', async () => {
      TestBed.configureTestingModule({
        providers: [
          ...httpProviders(),
          {
            provide: USER_POOL,
            useValue: fakeUserPool({
              getCurrentUser: () => {
                throw new Error('synthetic SDK failure');
              },
            }),
          },
        ],
      });
      const svc = TestBed.inject(Auth);
      await Promise.resolve();
      await Promise.resolve();
      expect(svc.isAuthenticated()).toBe(false);
      expect(svc.error()).toBe('synthetic SDK failure');
    });

    it('completeOAuthCallback writes _error and rethrows on state mismatch', async () => {
      TestBed.configureTestingModule({
        providers: [...httpProviders(), { provide: USER_POOL, useValue: fakeUserPool() }],
      });
      const svc = TestBed.inject(Auth);
      await Promise.resolve();
      await Promise.resolve();
      await expect(svc.completeOAuthCallback('code', 'wrong')).rejects.toMatchObject({
        name: 'OAuthError',
        code: 'state_mismatch',
      });
      expect(svc.error()).toContain('State mismatch');
    });
  });
});

describe('Auth.whenReady', () => {
  it('resolves after the first bootstrap settles and is reusable', async () => {
    TestBed.configureTestingModule({
      providers: [...httpProviders(), { provide: USER_POOL, useValue: { getCurrentUser: () => null } }],
    });
    const auth = TestBed.inject(Auth);

    await expect(auth.whenReady()).resolves.toBeUndefined();
    expect(auth.isLoading()).toBe(false);
    // second call returns an already-resolved promise
    await expect(auth.whenReady()).resolves.toBeUndefined();
  });
});

describe('Auth.getAccessToken', () => {
  it('returns the stored access token or null', () => {
    TestBed.configureTestingModule({
      providers: [...httpProviders(), { provide: USER_POOL, useValue: { getCurrentUser: () => null } }],
    });
    const auth = TestBed.inject(Auth);
    localStorage.removeItem('accessToken');
    expect(auth.getAccessToken()).toBeNull();
    localStorage.setItem('accessToken', 'acc-9');
    expect(auth.getAccessToken()).toBe('acc-9');
    localStorage.removeItem('accessToken');
  });
});

describe('Auth.refreshIdToken single-flight', () => {
  let savedDisableAuth: boolean;
  beforeEach(() => {
    savedDisableAuth = environment.disableAuth;
  });
  afterEach(() => {
    environment.disableAuth = savedDisableAuth;
  });

  it('shares one in-flight refresh across concurrent callers', async () => {
    let resolveSession!: (s: unknown) => void;
    const getSession = jest.fn((cb: (e: unknown, s: unknown) => void) => {
      void new Promise((r) => (resolveSession = r)).then((s) => cb(null, s));
    });
    const cognitoUser = { getSession };
    // Let bootstrap short-circuit (no getSession call) so whenReady() settles,
    // then exercise the real refresh path below.
    environment.disableAuth = true;
    TestBed.configureTestingModule({
      providers: [...httpProviders(), { provide: USER_POOL, useValue: { getCurrentUser: () => cognitoUser } }],
    });
    const auth = TestBed.inject(Auth);
    await auth.whenReady();
    environment.disableAuth = false;
    getSession.mockClear();

    const a = auth.refreshIdToken();
    const b = auth.refreshIdToken();
    resolveSession({
      isValid: () => true,
      getIdToken: () => ({ getJwtToken: () => 'fresh' }),
      getAccessToken: () => ({ getJwtToken: () => 'fresh-access' }),
    });

    await Promise.all([a, b]);
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});

describe('Auth.updateProfile / refreshUser', () => {
  beforeEach(() => {
    environment.disableAuth = true;
  });

  it('PUTs /api/auth/profile with the name and patches auth.user() on success', async () => {
    TestBed.configureTestingModule({
      providers: [...httpProviders(), { provide: USER_POOL, useValue: fakeUserPool() }],
    });
    const auth = TestBed.inject(Auth);
    await auth.whenReady();
    const http = TestBed.inject(HttpTestingController);

    const promise = auth.updateProfile('New Name');
    const req = http.expectOne('/api/auth/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ displayName: 'New Name' });
    req.flush({ message: 'Profile updated successfully', displayName: 'New Name' });
    await promise;

    expect(auth.user()?.displayName).toBe('New Name');
    http.verify();
  });

  it('rejects and leaves auth.user() unchanged on failure', async () => {
    TestBed.configureTestingModule({
      providers: [...httpProviders(), { provide: USER_POOL, useValue: fakeUserPool() }],
    });
    const auth = TestBed.inject(Auth);
    await auth.whenReady();
    const http = TestBed.inject(HttpTestingController);
    const nameBefore = auth.user()?.displayName;

    const promise = auth.updateProfile('Taken Name');
    const req = http.expectOne('/api/auth/profile');
    req.flush({ error: 'Validation error' }, { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toBeTruthy();
    expect(auth.user()?.displayName).toBe(nameBefore);
    http.verify();
  });
});

describe('Auth.changePassword', () => {
  beforeEach(() => {
    environment.disableAuth = true;
  });

  it('POSTs /api/auth/change-password with current/new passwords and resolves on success', async () => {
    TestBed.configureTestingModule({
      providers: [...httpProviders(), { provide: USER_POOL, useValue: fakeUserPool() }],
    });
    const auth = TestBed.inject(Auth);
    await auth.whenReady();
    const http = TestBed.inject(HttpTestingController);

    const promise = auth.changePassword('OldPass1!', 'NewPass1!');
    const req = http.expectOne('/api/auth/change-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' });
    req.flush({ message: 'Password changed' });

    await expect(promise).resolves.toBeUndefined();
    http.verify();
  });

  it('sends the Cognito access token on X-Access-Token, not the Authorization header', async () => {
    // Cognito's ChangePassword API requires the access token; the shared
    // authInterceptor always puts the ID token on Authorization, so this call
    // needs its own header carrying the access token. disableAuth=true seeds
    // both ID and access tokens to 'mock-jwt-token' on bootstrap.
    TestBed.configureTestingModule({
      providers: [...httpProviders(), { provide: USER_POOL, useValue: fakeUserPool() }],
    });
    const auth = TestBed.inject(Auth);
    await auth.whenReady();
    const http = TestBed.inject(HttpTestingController);

    const promise = auth.changePassword('OldPass1!', 'NewPass1!');
    const req = http.expectOne('/api/auth/change-password');
    expect(req.request.headers.get('X-Access-Token')).toBe(auth.getAccessToken());
    expect(req.request.headers.get('X-Access-Token')).toBe('mock-jwt-token');
    req.flush({ message: 'Password changed' });

    await expect(promise).resolves.toBeUndefined();
    http.verify();
  });

  it('rejects on failure (e.g. wrong current password) and does not touch auth.user()', async () => {
    TestBed.configureTestingModule({
      providers: [...httpProviders(), { provide: USER_POOL, useValue: fakeUserPool() }],
    });
    const auth = TestBed.inject(Auth);
    await auth.whenReady();
    const http = TestBed.inject(HttpTestingController);
    const userBefore = auth.user();

    const promise = auth.changePassword('WrongPass1!', 'NewPass1!');
    const req = http.expectOne('/api/auth/change-password');
    req.flush({ error: 'Incorrect current password' }, { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toBeTruthy();
    expect(auth.user()).toEqual(userBefore);
    http.verify();
  });
});
