/**
 * Cognito Configuration
 * 
 * Configures the Amazon Cognito User Pool for authentication.
 * This file should be imported wherever Cognito authentication is needed.
 */

import { CognitoUserPool } from 'amazon-cognito-identity-js';

const disableAuth = import.meta.env.VITE_DISABLE_AUTH === 'true';
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const cognitoEndpoint = import.meta.env.VITE_COGNITO_ENDPOINT;

const missingVars = [
  !userPoolId ? 'VITE_COGNITO_USER_POOL_ID' : null,
  !clientId ? 'VITE_COGNITO_CLIENT_ID' : null,
].filter((value): value is string => Boolean(value));

if (missingVars.length > 0 && !disableAuth) {
  throw new Error(
    `Missing required Cognito environment variable(s): ${missingVars.join(', ')}. ` +
      'Set these values during frontend build/deploy, or set VITE_DISABLE_AUTH=true for local development.'
  );
}

const poolData = {
  UserPoolId: userPoolId,
  ClientId: clientId,
  endpoint: cognitoEndpoint || undefined,
};

// Create and export the user pool instance
const userPool = new CognitoUserPool(poolData);

export default userPool;

// Export pool data for convenience
export { poolData };
