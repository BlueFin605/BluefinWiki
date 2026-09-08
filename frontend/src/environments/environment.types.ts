export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  cognito: {
    region: string;
    userPoolId: string;
    clientId: string;
    domain: string;
    redirectUri: string;
  };
  disableAuth: boolean;
  aiAllowDestructive: boolean;
}
