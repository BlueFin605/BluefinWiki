/**
 * Custom Cognito Authentication Utilities
 * 
 * Supports two flows:
 * 1. Direct authentication (USER_PASSWORD_AUTH) - for cognito-local in development
 * 2. Cognito Hosted UI (Authorization Code flow) - for production
 * 
 * Uses direct flow for local, Hosted UI for production based on environment.
 */

import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  ListUserPoolsCommand,
  ListUserPoolClientsCommand,
  InitiateAuthCommand as CognitoInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoUserSession, CognitoIdToken, CognitoAccessToken, CognitoRefreshToken } from 'amazon-cognito-identity-js';

const cognitoEndpoint = import.meta.env.VITE_COGNITO_ENDPOINT;
const region = import.meta.env.VITE_COGNITO_REGION || 'us-east-1';
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;

// Create Cognito client with optional local endpoint
const cognitoClient = new CognitoIdentityProviderClient({
  region,
  ...(cognitoEndpoint && {
    endpoint: cognitoEndpoint,
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  }),
});

export interface AuthResult {
  session: CognitoUserSession;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Authenticate user with USER_PASSWORD_AUTH flow
 * This is compatible with cognito-local
 */
export async function authenticateWithPassword(
  username: string,
  password: string
): Promise<AuthResult> {
  const isLocalEndpoint = Boolean(cognitoEndpoint);

  if (!clientId && !isLocalEndpoint) {
    throw new Error('Missing required Cognito environment variable: VITE_COGNITO_CLIENT_ID');
  }

  if (!userPoolId && !isLocalEndpoint) {
    throw new Error('Missing required Cognito environment variable: VITE_COGNITO_USER_POOL_ID');
  }

  let response;

  if (clientId) {
    try {
      response = await initiateAuth(clientId, username, password);
    } catch (error) {
      if (!isAppClientNotFound(error) || !cognitoEndpoint) {
        throw error;
      }

      response = await discoverAndAuthenticate(username, password);
    }
  } else {
    response = await discoverAndAuthenticate(username, password);
  }

  if (!response.AuthenticationResult) {
    throw new Error('Authentication failed: No authentication result');
  }

  const { IdToken, AccessToken, RefreshToken } = response.AuthenticationResult;

  if (!IdToken || !AccessToken || !RefreshToken) {
    throw new Error('Authentication failed: Missing tokens');
  }

  // Create CognitoUserSession compatible with amazon-cognito-identity-js
  const idToken = new CognitoIdToken({ IdToken });
  const accessToken = new CognitoAccessToken({ AccessToken });
  const refreshToken = new CognitoRefreshToken({ RefreshToken });

  const session = new CognitoUserSession({
    IdToken: idToken,
    AccessToken: accessToken,
    RefreshToken: refreshToken,
  });

  return {
    session,
    idToken: IdToken,
    accessToken: AccessToken,
    refreshToken: RefreshToken,
  };
}

async function initiateAuth(clientIdToUse: string, username: string, password: string) {
  const params: InitiateAuthCommandInput = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientIdToUse,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  const command = new InitiateAuthCommand(params);
  return cognitoClient.send(command);
}

function isAppClientNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'ResourceNotFoundException' ||
    error.message.includes('App Client') && error.message.includes('not found')
  );
}

async function discoverAndAuthenticate(username: string, password: string) {
  const poolIds = await discoverPoolIds();

  for (const poolId of poolIds) {
    const discoveredClientIds = await listClientIdsForPool(poolId);

    for (const candidateClientId of discoveredClientIds) {
      try {
        return await initiateAuth(candidateClientId, username, password);
      } catch (error) {
        if (isAppClientNotFound(error)) {
          continue;
        }

        throw error;
      }
    }
  }

  throw new Error('Authentication failed: no Cognito app clients found for local user pool');
}

async function discoverPoolIds(): Promise<string[]> {
  const poolIds = new Set<string>();

  if (userPoolId) {
    poolIds.add(userPoolId);
  }

  try {
    const pools = await cognitoClient.send(new ListUserPoolsCommand({ MaxResults: 60 }));

    for (const pool of pools.UserPools || []) {
      if (pool.Id) {
        poolIds.add(pool.Id);
      }
    }
  } catch {
    // Ignore discovery errors and fall back to configured pool id when available
  }

  return Array.from(poolIds);
}

async function listClientIdsForPool(poolId: string): Promise<string[]> {
  try {
    const listClients = await cognitoClient.send(
      new ListUserPoolClientsCommand({
        UserPoolId: poolId,
        MaxResults: 60,
      })
    );

    return (listClients.UserPoolClients || [])
      .map(client => client.ClientId)
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

/**
 * Cognito Hosted UI Authentication Flow
 * 
 * For production: redirects to Cognito Hosted UI login page.
 * User logs in there, then is redirected back to your app with auth code.
 * Must be configured in Cognito App Client:
 * - Callback URLs: https://yourdomain.com/auth/callback
 * - Allowed OAuth Flows: Authorization code grant
 * - Allowed OAuth Scopes: openid, email, profile
 */

/**
 * Redirect user to Cognito Hosted UI login page
 */
export function redirectToLogin(): void {
  if (!cognitoDomain || !clientId || !redirectUri) {
    throw new Error(
      'Cognito Hosted UI is not configured. Set VITE_COGNITO_DOMAIN, ' +
      'VITE_COGNITO_CLIENT_ID, and VITE_COGNITO_REDIRECT_URI environment variables.'
    );
  }

  // Generate a random state to prevent CSRF attacks
  const state = generateRandomString(32);
  sessionStorage.setItem('oauth_state', state);

  // Build the authorization request URL
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: state,
    scope: 'openid email profile',
  });

  const loginUrl = `https://${cognitoDomain}/oauth2/authorize?${params.toString()}`;
  window.location.href = loginUrl;
}

/**
 * Handle the OAuth callback from Cognito
 * Exchanges the authorization code for tokens
 */
export async function handleOAuthCallback(code: string, state: string): Promise<AuthResult> {
  // Verify state to prevent CSRF
  const savedState = sessionStorage.getItem('oauth_state');
  if (state !== savedState) {
    throw new Error('State mismatch. Possible CSRF attack.');
  }
  sessionStorage.removeItem('oauth_state');

  if (!cognitoDomain || !clientId || !redirectUri) {
    throw new Error('Cognito Hosted UI is not configured.');
  }

  // Exchange authorization code for tokens
  const tokenUrl = `https://${cognitoDomain}/oauth2/token`;
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange authorization code for tokens');
  }

  const tokenResponse = await response.json();
  const { id_token, access_token, refresh_token } = tokenResponse;

  if (!id_token || !access_token) {
    throw new Error('Missing tokens in OAuth response');
  }

  // Create CognitoUserSession from tokens
  const idToken = new CognitoIdToken({ IdToken: id_token });
  const accessToken = new CognitoAccessToken({ AccessToken: access_token });
  const refreshToken = new CognitoRefreshToken({ 
    RefreshToken: refresh_token || 'no-refresh-token' 
  });

  const session = new CognitoUserSession({
    IdToken: idToken,
    AccessToken: accessToken,
    RefreshToken: refreshToken,
  });

  return {
    session,
    idToken: id_token,
    accessToken: access_token,
    refreshToken: refresh_token || '',
  };
}

/**
 * Generate a random string for OAuth state parameter
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
