import { render, screen } from '@testing-library/angular';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { SettingsPage } from './settings-page';

function authStub(role: 'Admin' | 'Standard'): Partial<Auth> {
  return {
    user: (() => ({
      userId: 'u',
      email: 'a@b',
      displayName: 'A',
      role,
      emailVerified: true,
    })) as unknown as Auth['user'],
    isAuthenticated: (() => true) as unknown as Auth['isAuthenticated'],
  };
}

function providers(role: 'Admin' | 'Standard') {
  return [
    provideNoopAnimations(),
    provideRouter([]),
    { provide: Auth, useValue: authStub(role) },
  ];
}

describe('SettingsPage', () => {
  it('renders all admin tiles for admin users', async () => {
    await render(SettingsPage, { providers: providers('Admin') });
    expect(screen.getByRole('link', { name: /page types/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /user management/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /invitations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rebuild page index/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });

  it('hides admin-only tiles for standard users', async () => {
    await render(SettingsPage, { providers: providers('Standard') });
    expect(screen.queryByRole('link', { name: /page types/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /user management/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /invitations/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /rebuild page index/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });

  it('each admin tile links to the expected admin URL', async () => {
    await render(SettingsPage, { providers: providers('Admin') });
    expect(screen.getByRole('link', { name: /page types/i }).getAttribute('href')).toBe('/admin/page-types');
    expect(screen.getByRole('link', { name: /user management/i }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: /invitations/i }).getAttribute('href')).toBe('/admin/invitations');
    expect(screen.getByRole('link', { name: /rebuild page index/i }).getAttribute('href')).toBe('/admin/rebuild-page-index');
    expect(screen.getByRole('link', { name: /profile/i }).getAttribute('href')).toBe('/profile');
  });

  it('keeps a visible title and a back-to-pages affordance (global toolbar removed)', async () => {
    await render(SettingsPage, { providers: providers('Admin') });
    expect(screen.getByRole('heading', { level: 1, name: /settings/i })).toBeInTheDocument();
    const back = screen.getByRole('link', { name: /back to pages/i });
    expect(back.getAttribute('href')).toBe('/pages');
  });
});
