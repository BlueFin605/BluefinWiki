import { routes } from './app.routes';
import { adminGuard } from './core/auth/admin-guard';
import { authGuard } from './core/auth/auth-guard';

describe('app.routes', () => {
  it('guards /settings with authGuard and adminGuard', () => {
    const settings = routes.find((r) => r.path === 'settings');
    expect(settings?.canActivate).toEqual([authGuard, adminGuard]);
  });

  it('registers /403 and /redirecting', () => {
    expect(routes.some((r) => r.path === '403')).toBe(true);
    expect(routes.some((r) => r.path === 'redirecting')).toBe(true);
  });
});
