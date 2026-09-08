import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from './auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  let redirect: jest.Mock;
  let isAuthenticated: jest.Mock;
  let whenReady: jest.Mock;

  beforeEach(() => {
    redirect = jest.fn();
    isAuthenticated = jest.fn();
    whenReady = jest.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { isAuthenticated, redirectToLogin: redirect, whenReady } },
      ],
    });
  });

  function run(): Promise<unknown> {
    return Promise.resolve(
      TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ),
    );
  }

  it('awaits whenReady before deciding', async () => {
    isAuthenticated.mockReturnValue(true);
    await run();
    expect(whenReady).toHaveBeenCalledTimes(1);
  });

  it('returns true when authenticated', async () => {
    isAuthenticated.mockReturnValue(true);
    await expect(run()).resolves.toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects and returns false when not authenticated', async () => {
    isAuthenticated.mockReturnValue(false);
    await expect(run()).resolves.toBe(false);
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
