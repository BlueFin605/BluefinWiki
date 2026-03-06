/**
 * Test utilities and helpers
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const queryClient = new QueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>{children}</AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Mock Cognito user object
 */
export const mockCognitoUser = {
  username: 'test@example.com',
  pool: {
    userPoolId: 'us-east-1_TEST',
    clientId: 'test-client-id',
  },
  Session: null,
  client: {},
  signInUserSession: {
    idToken: {
      jwtToken: 'mock-id-token',
      payload: {
        sub: 'test-user-id',
        email: 'test@example.com',
        'cognito:username': 'test@example.com',
        'custom:role': 'Standard',
      },
    },
    refreshToken: {
      token: 'mock-refresh-token',
    },
    accessToken: {
      jwtToken: 'mock-access-token',
    },
  },
  authenticationFlowType: 'USER_SRP_AUTH',
};

/**
 * Mock authenticated user for testing
 */
export const mockAuthenticatedUser = {
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'Standard' as const,
  isAuthenticated: true,
};

/**
 * Mock admin user for testing
 */
export const mockAdminUser = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  role: 'Admin' as const,
  isAuthenticated: true,
};

/**
 * Create a mock error response from Cognito
 */
export function createCognitoError(code: string, message: string) {
  const error = new Error(message) as Error & { code: string; name: string };
  error.code = code;
  error.name = code;
  return error;
}

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));
