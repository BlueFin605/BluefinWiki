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
        { provide: Auth, useValue: { user } },
        { provide: Router, useValue: router },
      ],
    });
  });

  function run(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('returns true for Admin user', () => {
    user.mockReturnValue({ role: 'Admin' });
    expect(run()).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /pages for Standard user', () => {
    user.mockReturnValue({ role: 'Standard' });
    run();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/pages']);
  });

  it('redirects to /pages for null user', () => {
    user.mockReturnValue(null);
    run();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/pages']);
  });
});
