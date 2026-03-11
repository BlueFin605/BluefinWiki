/**
 * OAuth Callback Handler
 * 
 * This page is visited after the user completes login in Cognito Hosted UI.
 * Cognito redirects here with an authorization code, which we exchange for tokens.
 * 
 * Configure this URL as a Callback URL in your Cognito App Client settings.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { handleOAuthCallback } from '../../utils/cognitoAuth';
import { CognitoUser } from 'amazon-cognito-identity-js';
import userPool from '../../config/cognitoConfig';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthState } = useAuth() as any;
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle errors from Cognito
        if (errorParam) {
          throw new Error(
            `Authentication failed: ${errorParam}. ${errorDescription || ''}`
          );
        }

        if (!code) {
          throw new Error('No authorization code received from Cognito');
        }

        if (!state) {
          throw new Error('No state parameter received');
        }

        // Exchange authorization code for tokens
        const authResult = await handleOAuthCallback(code, state);

        // Decode the ID token to get user info
        const idToken = authResult.session.getIdToken();
        const payload = idToken.payload;

        // Create a CognitoUser instance and store the session
        const cognitoUser = new CognitoUser({
          Username: payload.email || payload['cognito:username'],
          Pool: userPool,
        });

        cognitoUser.setSignInUserSession(authResult.session);

        // Store tokens
        localStorage.setItem('idToken', authResult.idToken);
        if (authResult.refreshToken) {
          localStorage.setItem('refreshToken', authResult.refreshToken);
        }

        // Update auth context - manually call the auth context update
        // Since we bypassed the normal signIn flow
        const user = {
          userId: payload.sub,
          email: payload.email,
          displayName: payload.name || payload['cognito:username'],
          role: payload['custom:role'] || 'Standard',
          emailVerified: payload.email_verified,
        };

        if (setAuthState) {
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        }

        // Redirect to dashboard
        navigate('/dashboard');
      } catch (err: unknown) {
        console.error('OAuth callback error:', err);
        const error = err as { message?: string };
        setError(error.message || 'Authentication failed. Please try again.');

        // Redirect back to login after a delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setAuthState]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Authentication Error</h2>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <p className="text-xs text-red-600">
              Redirecting back to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="text-center">
        <div className="inline-block">
          <svg
            className="animate-spin h-8 w-8 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <p className="mt-4 text-gray-600">Completing your login...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
