/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Uses AWS Cognito for user authentication and session management.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  CognitoUser,
  CognitoUserSession,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';
import userPool from '../config/cognitoConfig';
import { User, AuthState, LoginCredentials } from '../types/auth';

interface AuthContextType extends AuthState {
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getCurrentSession: () => Promise<CognitoUserSession | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Extract user data from Cognito session
  const extractUserFromSession = (session: CognitoUserSession, cognitoUser: CognitoUser): User => {
    const idToken = session.getIdToken();
    const payload = idToken.payload;

    return {
      userId: payload.sub,
      email: payload.email || cognitoUser.getUsername(),
      displayName: payload.name || payload['cognito:username'],
      role: payload['custom:role'] || 'Standard',
      emailVerified: payload.email_verified,
    };
  };

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const cognitoUser = userPool.getCurrentUser();
        
        if (!cognitoUser) {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
          return;
        }

        // Get session (this also refreshes tokens if needed)
        const session = await new Promise<CognitoUserSession>((resolve, reject) => {
          cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
            if (err) {
              reject(err);
            } else if (session) {
              resolve(session);
            } else {
              reject(new Error('No session found'));
            }
          });
        });

        if (session.isValid()) {
          const user = extractUserFromSession(session, cognitoUser);
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Session check error:', error);
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    checkSession();
  }, []);

  // Sign in method
  const signIn = async (credentials: LoginCredentials): Promise<void> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const authenticationDetails = new AuthenticationDetails({
        Username: credentials.email,
        Password: credentials.password,
      });

      const cognitoUser = new CognitoUser({
        Username: credentials.email,
        Pool: userPool,
      });

      // Set device key if "remember me" is enabled
      if (credentials.rememberMe) {
        cognitoUser.setDeviceStatusRemembered({
          onSuccess: () => console.log('Device remembered'),
          onFailure: (err) => console.error('Failed to remember device:', err),
        });
      }

      const session = await new Promise<CognitoUserSession>((resolve, reject) => {
        cognitoUser.authenticateUser(authenticationDetails, {
          onSuccess: (session) => resolve(session),
          onFailure: (err) => reject(err),
          newPasswordRequired: (userAttributes) => {
            reject({
              code: 'NewPasswordRequired',
              message: 'New password required',
              userAttributes,
            });
          },
          mfaRequired: () => {
            reject({
              code: 'MFARequired',
              message: 'MFA verification required',
            });
          },
        });
      });

      const user = extractUserFromSession(session, cognitoUser);

      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      console.error('Sign in error:', err);
      const error = err as { code?: string; message?: string };
      
      let errorMessage = 'Failed to sign in. Please try again.';
      
      if (error.code === 'UserNotFoundException') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'NotAuthorizedException') {
        errorMessage = 'Incorrect email or password.';
      } else if (error.code === 'UserNotConfirmedException') {
        errorMessage = 'Please verify your email address before signing in.';
      } else if (error.code === 'PasswordResetRequiredException') {
        errorMessage = 'Password reset required. Please reset your password.';
      } else if (error.code === 'TooManyRequestsException') {
        errorMessage = 'Too many login attempts. Please try again later.';
      } else if (error.code === 'NewPasswordRequired') {
        errorMessage = 'You must change your password before continuing.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      throw error;
    }
  };

  // Sign out method
  const signOut = async (): Promise<void> => {
    try {
      const cognitoUser = userPool.getCurrentUser();
      
      if (cognitoUser) {
        cognitoUser.signOut();
      }

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    try {
      const cognitoUser = userPool.getCurrentUser();
      
      if (!cognitoUser) {
        throw new Error('No authenticated user');
      }

      const session = await new Promise<CognitoUserSession>((resolve, reject) => {
        cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
          if (err) {
            reject(err);
          } else if (session) {
            resolve(session);
          } else {
            reject(new Error('No session found'));
          }
        });
      });

      const user = extractUserFromSession(session, cognitoUser);
      
      setAuthState((prev) => ({
        ...prev,
        user,
      }));
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  };

  // Get current session
  const getCurrentSession = async (): Promise<CognitoUserSession | null> => {
    try {
      const cognitoUser = userPool.getCurrentUser();
      
      if (!cognitoUser) {
        return null;
      }

      return await new Promise<CognitoUserSession>((resolve, reject) => {
        cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
          if (err) {
            reject(err);
          } else if (session) {
            resolve(session);
          } else {
            reject(new Error('No session found'));
          }
        });
      });
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    ...authState,
    signIn,
    signOut,
    refreshUser,
    getCurrentSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
