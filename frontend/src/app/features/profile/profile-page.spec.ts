import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../core/auth/auth';
import { ProfilePage } from './profile-page';

function authStub(over: {
  user?: {
    userId: string;
    email: string;
    displayName: string;
    role: 'Admin' | 'Standard';
    emailVerified: boolean;
  } | null;
  signOut?: jest.Mock;
}): Partial<Auth> {
  const u = over.user === undefined
    ? {
        userId: 'u',
        email: 'me@x.com',
        displayName: 'Me',
        role: 'Standard' as const,
        emailVerified: true,
      }
    : over.user;
  return {
    user: (() => u) as unknown as Auth['user'],
    signOut: over.signOut ?? jest.fn(),
  };
}

function providers(stub: Partial<Auth>) {
  return [
    provideNoopAnimations(),
    provideRouter([]),
    { provide: Auth, useValue: stub },
  ];
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('ProfilePage', () => {
  it('renders the current user info', async () => {
    const stub = authStub({});
    await render(ProfilePage, { providers: providers(stub) });
    expect(screen.getByText('Me')).toBeInTheDocument();
    expect(screen.getByText('me@x.com')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  it('shows a "not signed in" message when user is null', async () => {
    const stub = authStub({ user: null });
    await render(ProfilePage, { providers: providers(stub) });
    expect(screen.getByText(/not signed in/i)).toBeInTheDocument();
  });

  it('sign-out button calls auth.signOut and navigates to root', async () => {
    const signOut = jest.fn();
    const stub = authStub({ signOut });
    await render(ProfilePage, { providers: providers(stub) });
    const router = TestBed.inject(Router);
    const navSpy = jest.spyOn(router, 'navigate');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    await settle();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navSpy).toHaveBeenCalledWith(['/']);
  });

  it('keeps a visible title and a back-to-pages affordance (global toolbar removed)', async () => {
    await render(ProfilePage, { providers: providers(authStub({})) });
    expect(screen.getByRole('heading', { level: 1, name: /profile/i })).toBeInTheDocument();
    const back = screen.getByRole('link', { name: /back to pages/i });
    expect(back.getAttribute('href')).toBe('/pages');
  });
});
