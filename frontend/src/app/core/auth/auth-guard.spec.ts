import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from './auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  let redirect: jest.Mock;
  let isAuthenticated: jest.Mock;
  let whenReady: jest.Mock;
  let router: { createUrlTree: jest.Mock };

  beforeEach(() => {
    redirect = jest.fn();
    isAuthenticated = jest.fn();
    whenReady = jest.fn().mockResolvedValue(undefined);
    router = { createUrlTree: jest.fn(() => ({ __urlTree: true })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { isAuthenticated, redirectToLogin: redirect, whenReady } },
        { provide: Router, useValue: router },
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

  it('routes to /redirecting when not authenticated', async () => {
    isAuthenticated.mockReturnValue(false);
    const result = await run();
    expect(result).toEqual({ __urlTree: true });
    expect(router.createUrlTree).toHaveBeenCalledWith(['/redirecting']);
    // The guard must NOT redirect directly — that is RedirectingComponent's job.
    expect(redirect).not.toHaveBeenCalled();
  });
});
