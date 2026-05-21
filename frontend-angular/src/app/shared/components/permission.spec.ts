import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { Auth } from '../../core/auth/auth';
import type { AuthUser } from '../../core/auth/auth.types';
import { Permission } from './permission';

@Component({
  selector: 'wiki-host',
  standalone: true,
  imports: [Permission],
  template: `
    <div *appPermission="'Admin'">admin-only</div>
    <div *appPermission="'Standard'">any-user</div>
  `,
})
class HostComponent {}

function authStub(user: AuthUser | null) {
  return { user: signal(user) };
}

describe('Permission', () => {
  it('shows Admin block to Admin and hides for Standard', async () => {
    await render(HostComponent, {
      providers: [{ provide: Auth, useValue: authStub({
        userId: 'u', email: 'e', displayName: 'd', role: 'Admin', emailVerified: true,
      }) }],
    });
    expect(screen.getByText('admin-only')).toBeInTheDocument();
    expect(screen.getByText('any-user')).toBeInTheDocument();
  });

  it('hides Admin block from Standard, shows Standard block', async () => {
    await render(HostComponent, {
      providers: [{ provide: Auth, useValue: authStub({
        userId: 'u', email: 'e', displayName: 'd', role: 'Standard', emailVerified: true,
      }) }],
    });
    expect(screen.queryByText('admin-only')).not.toBeInTheDocument();
    expect(screen.getByText('any-user')).toBeInTheDocument();
  });

  it('hides both blocks when not signed in', async () => {
    await render(HostComponent, {
      providers: [{ provide: Auth, useValue: authStub(null) }],
    });
    expect(screen.queryByText('admin-only')).not.toBeInTheDocument();
    expect(screen.queryByText('any-user')).not.toBeInTheDocument();
  });
});
