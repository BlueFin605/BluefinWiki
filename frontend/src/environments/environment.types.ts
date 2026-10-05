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
  /** wss URL (prod) or dev proxy path; empty disables realtime and X-Client-Id. */
  realtimeUrl: string;
}
