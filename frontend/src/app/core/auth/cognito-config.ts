import { InjectionToken } from '@angular/core';
import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';

/**
 * Lazily-constructed `CognitoUserPool`, exposed via Angular DI so tests can
 * substitute a fake via `{ provide: USER_POOL, useValue: ... }`. As a side
 * benefit, the config-validation throw fires on first injection rather than
 * at module load.
 */
export function createUserPool(): CognitoUserPool {
  const { userPoolId, clientId } = environment.cognito;

  const missing: string[] = [];
  if (!userPoolId) missing.push('cognito.userPoolId');
  if (!clientId) missing.push('cognito.clientId');

  if (missing.length > 0 && !environment.disableAuth) {
    throw new Error(
      `Missing required Cognito config: ${missing.join(', ')}. ` +
        'Set NG_APP_COGNITO_* env vars at build time, or set NG_APP_DISABLE_AUTH=true for local dev.',
    );
  }

  return new CognitoUserPool({
    UserPoolId: userPoolId || 'us-east-1_placeholder',
    ClientId: clientId || 'placeholder',
  });
}

export const USER_POOL = new InjectionToken<CognitoUserPool>('USER_POOL', {
  providedIn: 'root',
  factory: createUserPool,
});
