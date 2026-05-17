/**
 * API Configuration
 *
 * Centralised axios client. Handles two cross-cutting concerns:
 *  - attaches the current ID token to every outgoing request
 *  - on 401, asks the auth layer for a fresh session (which Cognito's SDK
 *    transparently refreshes via the long-lived refresh token), updates the
 *    stored token, and retries the original request once. Only if the
 *    refresh itself fails do we sign the user out.
 *
 * The auth callbacks are wired in from AuthProvider at startup via
 * `registerAuthHooks`, which avoids a circular import between this module
 * and the AuthContext.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const isLocalApiUrl = configuredApiBaseUrl
  ? /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredApiBaseUrl)
  : false;
const allowLocalApiInProd = import.meta.env.VITE_ALLOW_LOCAL_API_IN_PROD === 'true';

if (import.meta.env.PROD) {
  if (!configuredApiBaseUrl) {
    throw new Error('Missing VITE_API_BASE_URL for production build.');
  }

  if (isLocalApiUrl && !allowLocalApiInProd) {
    throw new Error(`Invalid VITE_API_BASE_URL for production build: ${configuredApiBaseUrl}`);
  }
}

export const API_BASE_URL = configuredApiBaseUrl || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

interface AuthHooks {
  refreshIdToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

let authHooks: AuthHooks | null = null;
let refreshInflight: Promise<string | null> | null = null;

export function registerAuthHooks(hooks: AuthHooks): void {
  authHooks = hooks;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('idToken') || localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !config || config._retried || !authHooks) {
      return Promise.reject(error);
    }

    config._retried = true;

    // Coalesce concurrent refresh attempts so simultaneous 401s share one
    // call to Cognito rather than racing.
    if (!refreshInflight) {
      refreshInflight = authHooks
        .refreshIdToken()
        .finally(() => {
          refreshInflight = null;
        });
    }

    let newToken: string | null = null;
    try {
      newToken = await refreshInflight;
    } catch {
      newToken = null;
    }

    if (!newToken) {
      // Refresh token is also expired/revoked — drop the user back to login.
      authHooks.signOut().catch(() => {});
      return Promise.reject(error);
    }

    config.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(config);
  }
);

export default apiClient;
