import type { Environment } from './environment.types';

export const environment: Environment = {
  production: false,
  apiBaseUrl: '/api',
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_testPoolId0',
    clientId: 'testclientid1234567890ab',
    domain: 'auth.dev.bluefinwiki.bluefin605.com',
    redirectUri: 'http://localhost:5173/callback',
  },
  disableAuth: true, // local dev default; flip to false to exercise real Cognito
  aiAllowDestructive: true,
};
