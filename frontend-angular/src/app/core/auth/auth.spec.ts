import { TestBed } from '@angular/core/testing';
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
        providers: [{ provide: USER_POOL, useValue: fakeUserPool() }],
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
        providers: [{ provide: USER_POOL, useValue: fakeUserPool() }],
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
        providers: [{ provide: USER_POOL, useValue: fakeUserPool() }],
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
