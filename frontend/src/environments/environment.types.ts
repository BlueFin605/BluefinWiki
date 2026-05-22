export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  cognito: {
    region: string;
    userPoolId: string;
    clientId: string;
    domain: string;
    redirectUri: string;
    endpoint?: string; // optional cognito-local endpoint
  };
  disableAuth: boolean;
  aiAllowDestructive: boolean;
}
