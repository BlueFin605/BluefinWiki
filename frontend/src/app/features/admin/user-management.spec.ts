import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UserManagement } from './user-management';
import type { UserRecord } from './users';

function userRec(over: Partial<UserRecord> = {}): UserRecord {
  return {
    userId: 'u-1',
    email: 'a@b.c',
    displayName: 'Alice',
    role: 'Standard',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
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

describe('UserManagement', () => {
  it('renders rows for each user', async () => {
    await render(UserManagement, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/admin/users').flush({
      users: [
        userRec({ userId: 'a', displayName: 'Alice', email: 'alice@x.com' }),
        userRec({ userId: 'b', displayName: 'Bob', email: 'bob@x.com' }),
      ],
    });
    await settle();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('search filters the visible rows', async () => {
    await render(UserManagement, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/admin/users').flush({
      users: [
        userRec({ userId: 'a', displayName: 'Alice', email: 'alice@x.com' }),
        userRec({ userId: 'b', displayName: 'Bob', email: 'bob@x.com' }),
      ],
    });
    await settle();

    const user = userEvent.setup();
    const search = screen.getByPlaceholderText(/search/i);
    await user.type(search, 'bob');
    await settle();

    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('edit dialog calls updateUser with the right body', async () => {
    const { fixture } = await render(UserManagement, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/admin/users').flush({
      users: [userRec({ userId: 'u-9', displayName: 'Alice', role: 'Standard' })],
    });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit alice/i }));
    await settle();
    fixture.detectChanges();

    const dialog = await screen.findByRole('dialog');
    const nameField = within(dialog).getByLabelText(/display name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Alicia');
    await settle();
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }));
    await flushDialog();

    const put = http.expectOne('/api/admin/users/u-9');
    expect(put.request.method).toBe('PUT');
    const body = put.request.body as { displayName: string; role: string };
    expect(body.displayName).toBe('Alicia');
    expect(body.role).toBe('Standard');
    put.flush(userRec({ userId: 'u-9', displayName: 'Alicia', role: 'Standard' }));
    await settle();
    http.expectOne('/api/admin/users').flush({
      users: [userRec({ userId: 'u-9', displayName: 'Alicia', role: 'Standard' })],
    });
    await settle();
  });

  it('delete prompts a confirm dialog and on confirm calls deleteUser', async () => {
    const { fixture } = await render(UserManagement, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/admin/users').flush({
      users: [userRec({ userId: 'u-del', displayName: 'Goner', email: 'gone@x.com' })],
    });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete goner/i }));
    await settle();
    fixture.detectChanges();

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    await flushDialog();

    const del = http.expectOne('/api/admin/users/u-del');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await settle();
    http.expectOne('/api/admin/users').flush({ users: [] });
    await settle();
  });
});
