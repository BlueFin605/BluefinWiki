/**
 * Cognito Configuration
 * 
 * Configures the Amazon Cognito User Pool for authentication.
 * This file should be imported wherever Cognito authentication is needed.
 */

import { CognitoUserPool } from 'amazon-cognito-identity-js';

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const cognitoEndpoint = import.meta.env.VITE_COGNITO_ENDPOINT;
const isTestMode = import.meta.env.MODE === 'test' || import.meta.env.VITEST === 'true';

const missingVars = [
  !userPoolId ? 'VITE_COGNITO_USER_POOL_ID' : null,
  !clientId ? 'VITE_COGNITO_CLIENT_ID' : null,
].filter((value): value is string => Boolean(value));

if (missingVars.length > 0 && !isTestMode) {
  throw new Error(
    `Missing required Cognito environment variable(s): ${missingVars.join(', ')}. ` +
      'Set these values during frontend build/deploy.'
  );
}

const poolData = {
  UserPoolId: userPoolId || 'test-user-pool-id',
  ClientId: clientId || 'test-client-id',
  endpoint: cognitoEndpoint || undefined,
};

// Create and export the user pool instance
const userPool = new CognitoUserPool(poolData);

export default userPool;

// Export pool data for convenience
export { poolData };
