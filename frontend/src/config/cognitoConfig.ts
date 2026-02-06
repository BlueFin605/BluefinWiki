/**
 * Cognito Configuration
 * 
 * Configures the Amazon Cognito User Pool for authentication.
 * This file should be imported wherever Cognito authentication is needed.
 */

import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'local_user_pool_id',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'local_client_id',
};

// Create and export the user pool instance
const userPool = new CognitoUserPool(poolData);

export default userPool;

// Export pool data for convenience
export { poolData };
