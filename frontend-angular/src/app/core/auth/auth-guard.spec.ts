import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from './auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  let redirect: jest.Mock;
  let isAuthenticated: jest.Mock;

  beforeEach(() => {
    redirect = jest.fn();
    isAuthenticated = jest.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: Auth, useValue: { isAuthenticated, redirectToLogin: redirect } }],
    });
  });

  function run(): unknown {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('returns true when authenticated', () => {
    isAuthenticated.mockReturnValue(true);
    expect(run()).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects and returns false when not authenticated', () => {
    isAuthenticated.mockReturnValue(false);
    expect(run()).toBe(false);
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
