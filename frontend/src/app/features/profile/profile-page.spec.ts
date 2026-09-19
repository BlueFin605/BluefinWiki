import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal, type WritableSignal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { Auth } from '../../core/auth/auth';
import { USER_POOL } from '../../core/auth/cognito-config';
import { errorInterceptor } from '../../core/api/error-interceptor';
import { ProfilePage } from './profile-page';

interface StubUser {
  userId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  emailVerified: boolean;
}

function defaultStubUser(): StubUser {
  return {
    userId: 'u',
    email: 'me@x.com',
    displayName: 'Me',
    role: 'Standard',
    emailVerified: true,
  };
}

/**
 * Auth stub whose `user` is a real signal so `updateProfile` mocks can patch
 * it, mirroring how the real Auth.refreshUser() updates auth.user() after a
 * successful PUT. `userSignal` is exposed for assertions.
 */
function authStub(over: {
  user?: StubUser | null;
  signOut?: jest.Mock;
  updateProfile?: jest.Mock;
  changePassword?: jest.Mock;
}): Partial<Auth> & { userSignal: WritableSignal<StubUser | null> } {
  const initial = over.user === undefined ? defaultStubUser() : over.user;
  const userSignal = signal<StubUser | null>(initial);
  const updateProfile =
    over.updateProfile ??
    jest.fn((displayName: string) => {
      const current = userSignal();
      if (current) userSignal.set({ ...current, displayName });
    });
  const changePassword = over.changePassword ?? jest.fn().mockResolvedValue(undefined);
  return {
    user: userSignal,
    signOut: over.signOut ?? jest.fn(),
    updateProfile,
    changePassword,
    userSignal,
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
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Me');
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
    expect(screen.getByRole('button', { name: /back to pages/i })).toBeInTheDocument();
  });
});

describe('ProfilePage - display name form', () => {
  it('disables Save when the name is blank/whitespace or unchanged, enables it when changed', async () => {
    const stub = authStub({});
    await render(ProfilePage, { providers: providers(stub) });
    const input = screen.getByLabelText(/display name/i);
    const save = screen.getByRole('button', { name: /^save$/i });
    const user = userEvent.setup();

    // Unchanged (still "Me").
    expect(save).toBeDisabled();

    // Blank.
    await user.clear(input);
    await settle();
    expect(save).toBeDisabled();

    // Whitespace only.
    await user.type(input, '   ');
    await settle();
    expect(save).toBeDisabled();

    // Changed to a real value.
    await user.clear(input);
    await user.type(input, 'New Name');
    await settle();
    expect(save).toBeEnabled();
  });

  it('Save PUTs the new name via Auth.updateProfile, shows a success toast, and auth.user() updates', async () => {
    const stub = authStub({});
    await render(ProfilePage, { providers: providers(stub) });
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    const input = screen.getByLabelText(/display name/i);
    const user = userEvent.setup();

    await user.clear(input);
    await user.type(input, 'New Name');
    await settle();
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await settle();

    expect(stub.updateProfile).toHaveBeenCalledWith('New Name');
    expect(openSpy).toHaveBeenCalledWith('Profile updated.', 'Dismiss', { duration: 4000 });
    expect(stub.userSignal()?.displayName).toBe('New Name');
  });

  it('shows the server error message on failure (ApiError-shaped rejection from the interceptor chain) and keeps the entered value', async () => {
    // This mirrors what Auth.updateProfile() actually rejects with in production: the
    // errorInterceptor turns every HttpErrorResponse into a plain ApiError object, not an
    // Error instance. See frontend/src/app/core/api/error-interceptor.ts.
    const updateProfile = jest.fn().mockRejectedValue({
      status: 400,
      code: 'validation_error',
      message: 'Display name already taken',
      requestId: 'req-123',
    });
    const stub = authStub({ updateProfile });
    await render(ProfilePage, { providers: providers(stub) });
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    const input = screen.getByLabelText(/display name/i);
    const user = userEvent.setup();

    await user.clear(input);
    await user.type(input, 'Taken Name');
    await settle();
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await settle();

    expect(openSpy).toHaveBeenCalledWith('Display name already taken', 'Dismiss', { duration: 4000 });
    expect(input).toHaveValue('Taken Name');
    expect(stub.userSignal()?.displayName).toBe('Me');
  });

  it('shows the error message on failure (plain Error rejection, e.g. a network failure before the interceptor runs) and keeps the entered value', async () => {
    const updateProfile = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    const stub = authStub({ updateProfile });
    await render(ProfilePage, { providers: providers(stub) });
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    const input = screen.getByLabelText(/display name/i);
    const user = userEvent.setup();

    await user.clear(input);
    await user.type(input, 'Taken Name');
    await settle();
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await settle();

    expect(openSpy).toHaveBeenCalledWith('Failed to fetch', 'Dismiss', { duration: 4000 });
    expect(input).toHaveValue('Taken Name');
    expect(stub.userSignal()?.displayName).toBe('Me');
  });
});

describe('ProfilePage - change password form', () => {
  function passwordFields() {
    return {
      current: screen.getByLabelText(/current password/i),
      next: screen.getByLabelText(/^new password$/i),
      confirm: screen.getByLabelText(/confirm password/i),
      submit: screen.getByRole('button', { name: /change password/i }),
    };
  }

  it('disables submit until all three fields are non-empty', async () => {
    const stub = authStub({});
    await render(ProfilePage, { providers: providers(stub) });
    const { current, next, confirm, submit } = passwordFields();
    const user = userEvent.setup();

    expect(submit).toBeDisabled();

    await user.type(current, 'OldPass1!');
    await settle();
    expect(submit).toBeDisabled();

    await user.type(next, 'NewPass1!');
    await settle();
    expect(submit).toBeDisabled();

    await user.type(confirm, 'NewPass1!');
    await settle();
    expect(submit).toBeEnabled();
  });

  it('shows an inline mismatch message and blocks submit when New != Confirm', async () => {
    const changePassword = jest.fn().mockResolvedValue(undefined);
    const stub = authStub({ changePassword });
    await render(ProfilePage, { providers: providers(stub) });
    const { current, next, confirm, submit } = passwordFields();
    const user = userEvent.setup();

    await user.type(current, 'OldPass1!');
    await user.type(next, 'NewPass1!');
    await user.type(confirm, 'Different1!');
    await settle();

    expect(screen.getByText(/new passwords do not match/i)).toBeInTheDocument();
    // Blocked: the submit button itself is disabled while mismatched, so no
    // click can reach it and Auth.changePassword is never invoked.
    expect(submit).toBeDisabled();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('submits current/new password, shows a success toast, and clears all three fields', async () => {
    const changePassword = jest.fn().mockResolvedValue(undefined);
    const stub = authStub({ changePassword });
    await render(ProfilePage, { providers: providers(stub) });
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    const { current, next, confirm, submit } = passwordFields();
    const user = userEvent.setup();

    await user.type(current, 'OldPass1!');
    await user.type(next, 'NewPass1!');
    await user.type(confirm, 'NewPass1!');
    await settle();
    await user.click(submit);
    await settle();

    expect(changePassword).toHaveBeenCalledWith('OldPass1!', 'NewPass1!');
    expect(openSpy).toHaveBeenCalledWith('Password changed.', 'Dismiss', { duration: 4000 });
    expect(current).toHaveValue('');
    expect(next).toHaveValue('');
    expect(confirm).toHaveValue('');
  });

  it('shows the server error message on failure and retains the typed values', async () => {
    const changePassword = jest.fn().mockRejectedValue({
      status: 400,
      code: 'validation_error',
      message: 'Incorrect current password',
      requestId: 'req-456',
    });
    const stub = authStub({ changePassword });
    await render(ProfilePage, { providers: providers(stub) });
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    const { current, next, confirm, submit } = passwordFields();
    const user = userEvent.setup();

    await user.type(current, 'WrongPass1!');
    await user.type(next, 'NewPass1!');
    await user.type(confirm, 'NewPass1!');
    await settle();
    await user.click(submit);
    await settle();

    expect(openSpy).toHaveBeenCalledWith('Incorrect current password', 'Dismiss', { duration: 4000 });
    expect(current).toHaveValue('WrongPass1!');
    expect(next).toHaveValue('NewPass1!');
    expect(confirm).toHaveValue('NewPass1!');
  });

  it('surfaces the real server message end-to-end through Auth -> errorInterceptor -> snackbar (regression for Finding 2)', async () => {
    // Unlike every other test in this file (which stubs Auth wholesale), this
    // one uses the real Auth service plus the real errorInterceptor — the same
    // precedent as board-view.spec.ts's baseProviders(), which registers
    // errorInterceptor "so a failed PUT's error mirrors production". It flushes
    // a realistic backend envelope (`{ error: '...' }`, per every handler in
    // backend/src) and asserts the actual server message reaches the toast, not
    // a generic fallback. This fails before the Finding 2 fix and passes after.
    environment.disableAuth = true;
    await render(ProfilePage, {
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: USER_POOL, useValue: { getCurrentUser: () => null } },
      ],
    });
    const auth = TestBed.inject(Auth);
    await auth.whenReady();
    await settle();

    const http = TestBed.inject(HttpTestingController);
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    const { current, next, confirm, submit } = passwordFields();
    const user = userEvent.setup();

    await user.type(current, 'WrongPass1!');
    await user.type(next, 'NewPass1!');
    await user.type(confirm, 'NewPass1!');
    await settle();
    await user.click(submit);
    await settle();

    const req = http.expectOne('/api/auth/change-password');
    req.flush({ error: 'Incorrect current password' }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(openSpy).toHaveBeenCalledWith('Incorrect current password', 'Dismiss', { duration: 4000 });
    http.verify();
  });
});
