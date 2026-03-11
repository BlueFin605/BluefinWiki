/**
 * Authentication Type Definitions
 * 
 * Defines types for authentication-related data structures.
 */

export interface User {
  userId: string; // Cognito sub claim
  email: string;
  displayName?: string;
  role: 'Admin' | 'Standard';
  emailVerified?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData {
  email: string;
  password: string;
  displayName: string;
  inviteCode: string;
  acceptTerms: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmation {
  email: string;
  code: string;
  newPassword: string;
}

export interface CognitoError {
  code: string;
  message: string;
  name: string;
}
