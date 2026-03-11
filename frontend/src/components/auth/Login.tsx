/**
 * Login Page Component
 * 
 * Supports two authentication flows:
 * 1. Local Development: Instant bypass (VITE_DISABLE_AUTH=true)
 * 2. Production: AWS Cognito Hosted UI (VITE_DISABLE_AUTH=false)
 */

import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { redirectToLogin } from '../../utils/cognitoAuth';

const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === 'true';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, error: contextError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Production: Redirect to Cognito Hosted UI
    if (!DISABLE_AUTH) {
      try {
        setLoading(true);
        redirectToLogin();
      } catch (err) {
        console.error('Redirect to login failed:', err);
        const error = err as { message?: string };
        setError(error.message || 'Failed to redirect to login. Please try again.');
        setLoading(false);
      }
      return;
    }

    // Local dev: Any credentials work, just need email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);

    try {
      await signIn({
        email: email.trim(),
        password: password || 'dev-password', // Any password works in dev mode
      });

      navigate('/dashboard');
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError(contextError || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to BlueFinWiki
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {DISABLE_AUTH ? (
              <>
                Development Mode
                <br />
                <span className="text-xs text-gray-500">(Any email works)</span>
              </>
            ) : (
              <>
                Or{' '}
                <Link
                  to="/register"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  create a new account
                </Link>
              </>
            )}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          {/* Password Input - Only used in local dev mode */}
          {DISABLE_AUTH && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-gray-500 text-xs">(any password works in dev)</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                  {DISABLE_AUTH ? 'Signing in...' : 'Redirecting to login...'}
                </>
              ) : (
                DISABLE_AUTH ? 'Sign in' : 'Sign in with AWS Cognito'
              )}
            </button>
          </div>
        </form>

        {/* Additional Help */}
        <div className="text-center">
          <p className="text-xs text-gray-600">
            Need help?{' '}
            <a href="mailto:support@bluefinwiki.com" className="text-blue-600 hover:text-blue-500">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
