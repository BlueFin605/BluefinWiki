/**
 * Custom Cognito Authentication Utilities
 * 
 * Provides authentication helpers that work with both AWS Cognito and cognito-local.
 * Uses USER_PASSWORD_AUTH flow which is supported by cognito-local.
 */

import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  ListUserPoolsCommand,
  ListUserPoolClientsCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoUserSession, CognitoIdToken, CognitoAccessToken, CognitoRefreshToken } from 'amazon-cognito-identity-js';

const cognitoEndpoint = import.meta.env.VITE_COGNITO_ENDPOINT;
const region = import.meta.env.VITE_COGNITO_REGION || 'us-east-1';
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

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
