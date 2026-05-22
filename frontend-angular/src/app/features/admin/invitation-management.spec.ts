import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { InvitationManagement } from './invitation-management';
import type { Invitation } from './invitations';

function invite(over: Partial<Invitation> = {}): Invitation {
  return {
    inviteCode: 'inv-1',
    role: 'Standard',
    createdBy: { userId: 'u', displayName: 'Admin' },
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-08T00:00:00Z',
    status: 'pending',
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function flushDialog(): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
  await settle();
}

function providers() {
  return [
    provideNoopAnimations(),
    provideRouter([]),
    provideHttpClient(),
    provideHttpClientTesting(),
  ];
}

describe('InvitationManagement', () => {
  it('renders invitations', async () => {
    await render(InvitationManagement, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/admin/invitations').flush({
      invitations: [
        invite({ inviteCode: 'AAA', email: 'foo@x.com' }),
        invite({ inviteCode: 'BBB', email: 'bar@x.com' }),
      ],
    });
    await settle();
    expect(screen.getByText('AAA')).toBeInTheDocument();
    expect(screen.getByText('BBB')).toBeInTheDocument();
  });

  it('opens the create dialog and POSTs the invitation', async () => {
    const { fixture } = await render(InvitationManagement, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/admin/invitations').flush({ invitations: [] });
    await settle();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /create invitation/i }));
    await settle();
    fixture.detectChanges();

    const dialog = await screen.findByRole('dialog');
    const emailField = within(dialog).getByLabelText(/email/i);
    await user.type(emailField, 'new@x.com');
    await settle();

    await user.click(within(dialog).getByRole('button', { name: /^create$/i }));
    await flushDialog();

    const post = http.expectOne('/api/admin/invitations');
    expect(post.request.method).toBe('POST');
    const body = post.request.body as { email: string; role: string };
    expect(body.email).toBe('new@x.com');
    expect(body.role).toBe('Standard');
    post.flush(invite({ inviteCode: 'NEW', email: 'new@x.com' }));
    await settle();
    http.expectOne('/api/admin/invitations').flush({
      invitations: [invite({ inviteCode: 'NEW', email: 'new@x.com' })],
    });
    await settle();
  });

  it('revoke calls DELETE', async () => {
    const { fixture } = await render(InvitationManagement, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/admin/invitations').flush({
      invitations: [invite({ inviteCode: 'RVK', status: 'pending' })],
    });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /revoke rvk/i }));
    await settle();

    const del = http.expectOne('/api/admin/invitations/RVK');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await settle();
    http.expectOne('/api/admin/invitations').flush({ invitations: [] });
    await settle();
  });
});
