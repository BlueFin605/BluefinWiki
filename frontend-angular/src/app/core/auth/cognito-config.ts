import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';

const { userPoolId, clientId, endpoint } = environment.cognito;

const missing: string[] = [];
if (!userPoolId) missing.push('cognito.userPoolId');
if (!clientId) missing.push('cognito.clientId');

if (missing.length > 0 && !environment.disableAuth) {
  throw new Error(
    `Missing required Cognito config: ${missing.join(', ')}. ` +
      'Set NG_APP_COGNITO_* env vars at build time, or set NG_APP_DISABLE_AUTH=true for local dev.',
  );
}

export const userPool = new CognitoUserPool({
  UserPoolId: userPoolId || 'us-east-1_placeholder',
  ClientId: clientId || 'placeholder',
  endpoint: endpoint || undefined,
});
