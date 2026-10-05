import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { Auth } from './core/auth/auth';
import type { AuthUser } from './core/auth/auth.types';
import { Realtime } from './core/realtime/realtime';

const USER: AuthUser = {
  userId: 'u',
  email: 'u@example.com',
  displayName: 'U',
  role: 'Admin',
  emailVerified: true,
};

async function setup(initialUser: AuthUser | null = null) {
  const user = signal<AuthUser | null>(initialUser);
  const realtime = { start: jest.fn(), stop: jest.fn() };
  const result = await render(App, {
    providers: [
      provideRouter([]),
      { provide: Auth, useValue: { user } },
      { provide: Realtime, useValue: realtime },
    ],
  });
  return { ...result, user, realtime };
}

describe('App', () => {
  it('renders only the router outlet, with no global toolbar', async () => {
    const { container } = await setup();

    expect(container.querySelector('router-outlet')).not.toBeNull();
    expect(container.querySelector('mat-toolbar')).toBeNull();
    expect(container.textContent ?? '').not.toContain('BlueFinWiki');
  });

  it('starts realtime while signed in and stops it on sign-out', async () => {
    const { user, realtime } = await setup();
    expect(realtime.start).not.toHaveBeenCalled();
    expect(realtime.stop).toHaveBeenCalled();

    user.set(USER);
    TestBed.tick();
    expect(realtime.start).toHaveBeenCalledTimes(1);

    realtime.stop.mockClear();
    user.set(null);
    TestBed.tick();
    expect(realtime.stop).toHaveBeenCalledTimes(1);
  });
});
