/**
 * Forgot Password Component
 * 
 * Allows users to request a password reset by entering their email address.
 * Uses AWS Cognito's forgotPassword API to trigger the reset flow.
 */

import React, { useState } from 'react';
import { CognitoUser } from 'amazon-cognito-identity-js';
import userPool from '../../config/cognitoConfig';

interface ForgotPasswordProps {
  onResetRequested?: (email: string) => void;
  onCancel?: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onResetRequested, onCancel }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Create CognitoUser instance
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      // Request password reset
      await new Promise((resolve, reject) => {
        cognitoUser.forgotPassword({
          onSuccess: (data) => {
            console.log('Password reset code sent:', data);
            resolve(data);
          },
          onFailure: (err) => {
            console.error('Password reset error:', err);
            reject(err);
          },
        });
      });

      setSuccess(true);
      if (onResetRequested) {
        onResetRequested(email);
      }
    } catch (err: unknown) {
      console.error('Error requesting password reset:', err);
      const error = err as { code?: string; message?: string };
      
      // Handle specific error types
      if (error.code === 'UserNotFoundException') {
        setError('No account found with this email address.');
      } else if (error.code === 'LimitExceededException') {
        setError('Too many password reset attempts. Please try again later.');
      } else if (error.code === 'InvalidParameterException') {
        setError('Invalid email address format.');
      } else if (error.code === 'NotAuthorizedException') {
        setError('This account is not eligible for password reset.');
      } else {
        setError(error.message || 'Failed to send password reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="forgot-password-success">
        <div className="success-icon">
          <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-center mt-4 mb-2">Check Your Email</h2>
        <p className="text-gray-600 text-center mb-6">
          We've sent a password reset code to <strong>{email}</strong>
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Next steps:</strong>
          </p>
          <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-1">
            <li>Check your email inbox (and spam folder)</li>
            <li>Copy the verification code from the email</li>
            <li>Return here to reset your password</li>
          </ol>
        </div>
        <div className="text-center text-sm text-gray-600">
          Didn't receive the email?{' '}
          <button
            onClick={() => {
              setSuccess(false);
              setEmail('');
            }}
            className="text-purple-600 hover:text-purple-800 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-form">
      <h2 className="text-2xl font-bold text-center mb-2">Reset Your Password</h2>
      <p className="text-gray-600 text-center mb-6">
        Enter your email address and we'll send you a verification code to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="email"
            autoFocus
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </span>
          ) : (
            'Send Reset Code'
          )}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full bg-white text-gray-700 py-2 px-4 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        )}
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-center text-sm text-gray-600">
          Remember your password?{' '}
          <a href="/login" className="text-purple-600 hover:text-purple-800 font-medium">
            Back to login
          </a>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
