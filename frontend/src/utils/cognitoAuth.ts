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
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoUserSession, CognitoIdToken, CognitoAccessToken, CognitoRefreshToken } from 'amazon-cognito-identity-js';

const cognitoEndpoint = import.meta.env.VITE_COGNITO_ENDPOINT;
const region = import.meta.env.VITE_COGNITO_REGION || 'us-east-1';
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || 'local-client-id';

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
  const params: InitiateAuthCommandInput = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  const command = new InitiateAuthCommand(params);
  const response = await cognitoClient.send(command);

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
