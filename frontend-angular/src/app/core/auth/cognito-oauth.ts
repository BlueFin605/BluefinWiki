import {
  CognitoAccessToken,
  CognitoIdToken,
  CognitoRefreshToken,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';

export interface AuthResult {
  session: CognitoUserSession;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

const STATE_KEY = 'oauth_state';

/**
 * Builds the Cognito Hosted UI /oauth2/authorize URL and stores the
 * CSRF-protection state token in sessionStorage. Extracted from
 * {@link redirectToLogin} so it can be exercised in tests without
 * triggering jsdom navigation (window.location.href is a non-configurable
 * accessor and cannot be reliably stubbed).
 */
export function buildAuthorizeUrl(): string {
  const { domain, clientId, redirectUri } = environment.cognito;
  if (!domain || !clientId || !redirectUri) {
    throw new Error(
      'Cognito Hosted UI is not configured. Set NG_APP_COGNITO_DOMAIN, ' +
        'NG_APP_COGNITO_CLIENT_ID, NG_APP_COGNITO_REDIRECT_URI.',
    );
  }

  const state = generateRandomString(32);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    scope: 'openid email profile',
  });

  return `https://${domain}/oauth2/authorize?${params.toString()}`;
}

export function redirectToLogin(): void {
  const url = buildAuthorizeUrl();
  window.location.href = url;
}

export async function handleOAuthCallback(code: string, state: string): Promise<AuthResult> {
  const savedState = sessionStorage.getItem(STATE_KEY);
  if (state !== savedState) throw new Error('State mismatch. Possible CSRF attack.');
  sessionStorage.removeItem(STATE_KEY);

  const { domain, clientId, redirectUri } = environment.cognito;
  if (!domain || !clientId || !redirectUri) throw new Error('Cognito Hosted UI is not configured.');

  const response = await fetch(`https://${domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) throw new Error('Failed to exchange authorization code for tokens');

  const tokens = (await response.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };

  if (!tokens.id_token || !tokens.access_token) {
    throw new Error('Missing tokens in OAuth response');
  }

  const session = new CognitoUserSession({
    IdToken: new CognitoIdToken({ IdToken: tokens.id_token }),
    AccessToken: new CognitoAccessToken({ AccessToken: tokens.access_token }),
    RefreshToken: new CognitoRefreshToken({ RefreshToken: tokens.refresh_token ?? 'no-refresh-token' }),
  });

  return {
    session,
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? '',
  };
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
