import { Injectable, computed, inject, signal } from '@angular/core';
import { CognitoUser, type CognitoUserSession } from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';
import { USER_POOL } from './cognito-config';
import {
  handleOAuthCallback,
  redirectToLogin as cognitoRedirectToLogin,
  type AuthResult,
} from './cognito-oauth';
import type { AuthUser, Role } from './auth.types';

const ID_TOKEN_KEY = 'idToken';
const ACCESS_TOKEN_KEY = 'accessToken';

const MOCK_ADMIN: AuthUser = {
  userId: 'local-dev-user-id',
  email: 'dev@example.com',
  displayName: 'Local Dev User',
  role: 'Admin',
  emailVerified: true,
};

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly userPool = inject(USER_POOL);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isLoading = signal(true);
  private readonly _error = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly roles = computed<readonly Role[]>(() => {
    const u = this._user();
    return u ? [u.role] : [];
  });

  constructor() {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      if (environment.disableAuth) {
        localStorage.setItem(ID_TOKEN_KEY, 'mock-jwt-token');
        localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-jwt-token');
        this._user.set(MOCK_ADMIN);
        return;
      }

      const cognitoUser = this.userPool.getCurrentUser();
      if (!cognitoUser) {
        this._user.set(null);
        return;
      }

      const session = await getSessionAsync(cognitoUser);
      if (!session.isValid()) {
        this.clearTokens();
        this._user.set(null);
        return;
      }

      this.persistSession(session);
      this._user.set(extractUser(session, cognitoUser));
    } catch (err: unknown) {
      this.clearTokens();
      this._user.set(null);
      this._error.set(errorMessage(err));
    } finally {
      this._isLoading.set(false);
    }
  }

  async completeOAuthCallback(code: string, state: string): Promise<void> {
    try {
      const result: AuthResult = await handleOAuthCallback(code, state);
      const username = readUsernameFromPayload(result.session);
      const cognitoUser = new CognitoUser({ Username: username, Pool: this.userPool });
      cognitoUser.setSignInUserSession(result.session);
      this.persistSession(result.session);
      this._user.set(extractUser(result.session, cognitoUser));
      this._error.set(null);
    } catch (err: unknown) {
      this.clearTokens();
      this._user.set(null);
      this._error.set(errorMessage(err));
      throw err;
    } finally {
      this._isLoading.set(false);
    }
  }

  signOut(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut();
    this.clearTokens();
    this._user.set(null);
  }

  redirectToLogin(): void {
    cognitoRedirectToLogin();
  }

  getIdToken(): string | null {
    return localStorage.getItem(ID_TOKEN_KEY);
  }

  async refreshIdToken(): Promise<string | null> {
    if (environment.disableAuth) return localStorage.getItem(ID_TOKEN_KEY);
    const cognitoUser = this.userPool.getCurrentUser();
    if (!cognitoUser) return null;
    try {
      const session = await getSessionAsync(cognitoUser);
      if (!session.isValid()) return null;
      this.persistSession(session);
      return session.getIdToken().getJwtToken();
    } catch {
      return null;
    }
  }

  private persistSession(session: CognitoUserSession): void {
    localStorage.setItem(ID_TOKEN_KEY, session.getIdToken().getJwtToken());
    localStorage.setItem(ACCESS_TOKEN_KEY, session.getAccessToken().getJwtToken());
  }

  private clearTokens(): void {
    localStorage.removeItem(ID_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

function getSessionAsync(user: CognitoUser): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) reject(err);
      else if (session) resolve(session);
      else reject(new Error('No session found'));
    });
  });
}

function extractUser(session: CognitoUserSession, cognitoUser: CognitoUser): AuthUser {
  const payload = session.getIdToken().payload as Record<string, unknown>;
  return {
    userId: asString(payload['sub'], ''),
    email: asString(payload['email'], cognitoUser.getUsername()),
    displayName: asString(payload['name'] ?? payload['cognito:username'], cognitoUser.getUsername()),
    // TODO: validate role at runtime — see "Auth role runtime validation"
    // in the Phase 1 plan's spec-to-plan adjustments.
    role: (payload['custom:role'] as Role) ?? 'Standard',
    emailVerified: Boolean(payload['email_verified']),
  };
}

function readUsernameFromPayload(session: CognitoUserSession): string {
  const payload = session.getIdToken().payload as Record<string, unknown>;
  return (
    asString(payload['cognito:username'], '') ||
    asString(payload['email'], '') ||
    asString(payload['sub'], '') ||
    'unknown'
  );
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}
