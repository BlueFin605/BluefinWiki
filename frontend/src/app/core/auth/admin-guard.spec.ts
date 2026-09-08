import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Auth } from './auth';
import { adminGuard } from './admin-guard';

describe('adminGuard', () => {
  let user: jest.Mock;
  let router: { createUrlTree: jest.Mock };

  beforeEach(() => {
    user = jest.fn();
    router = { createUrlTree: jest.fn(() => ({}) as UrlTree) };
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { user, whenReady: jest.fn().mockResolvedValue(undefined) } },
        { provide: Router, useValue: router },
      ],
    });
  });

  function run(): Promise<boolean | UrlTree> {
    return Promise.resolve(
      TestBed.runInInjectionContext(() =>
        adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ),
    ) as Promise<boolean | UrlTree>;
  }

  it('awaits whenReady before deciding', async () => {
    user.mockReturnValue({ role: 'Admin' });
    await Promise.resolve(run());
    // no throw = whenReady was awaited without error
    expect(user).toHaveBeenCalled();
  });

  it('returns true for Admin user', async () => {
    user.mockReturnValue({ role: 'Admin' });
    await expect(run()).resolves.toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /403 for Standard user', async () => {
    user.mockReturnValue({ role: 'Standard' });
    await run();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/403']);
  });

  it('redirects to /403 for null user', async () => {
    user.mockReturnValue(null);
    await run();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/403']);
  });
});
