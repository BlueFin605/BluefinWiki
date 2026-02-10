/**
 * Reset Password Component
 * 
 * Allows users to reset their password using a verification code sent to their email.
 * Uses AWS Cognito's confirmPassword API to complete the reset flow.
 */

import React, { useState } from 'react';
import { CognitoUser } from 'amazon-cognito-identity-js';
import userPool from '../../config/cognitoConfig';

interface ResetPasswordProps {
  email?: string;
  onResetComplete?: () => void;
  onCancel?: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ email: initialEmail, onResetComplete, onCancel }) => {
  const [email, setEmail] = useState(initialEmail || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password strength validation
  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('At least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('At least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('At least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('At least one number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('At least one special character');
    }
    
    return errors;
  };

  const passwordErrors = validatePassword(newPassword);
  const isPasswordValid = newPassword && passwordErrors.length === 0;
  const doPasswordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (!email || !verificationCode || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Create CognitoUser instance
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      // Confirm password reset with verification code
      await new Promise((resolve, reject) => {
        cognitoUser.confirmPassword(verificationCode, newPassword, {
          onSuccess: () => {
            console.log('Password reset successful');
            resolve(true);
          },
          onFailure: (err) => {
            console.error('Password reset confirmation error:', err);
            reject(err);
          },
        });
      });

      setSuccess(true);
      
      // Call completion callback after 2 seconds
      setTimeout(() => {
        if (onResetComplete) {
          onResetComplete();
        }
      }, 2000);
    } catch (err: unknown) {
      console.error('Error resetting password:', err);
      const error = err as { code?: string; message?: string };
      
      // Handle specific error types
      if (error.code === 'CodeMismatchException') {
        setError('Invalid verification code. Please check and try again.');
      } else if (error.code === 'ExpiredCodeException') {
        setError('Verification code has expired. Please request a new one.');
      } else if (error.code === 'InvalidPasswordException') {
        setError('Password does not meet the requirements.');
      } else if (error.code === 'LimitExceededException') {
        setError('Too many attempts. Please try again later.');
      } else if (error.code === 'UserNotFoundException') {
        setError('User not found. Please check your email address.');
      } else {
        setError(error.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="reset-password-success">
        <div className="success-icon">
          <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-center mt-4 mb-2">Password Reset Successfully!</h2>
        <p className="text-gray-600 text-center mb-6">
          Your password has been reset. You can now log in with your new password.
        </p>
        <div className="text-center">
          <a
            href="/login"
            className="inline-block bg-purple-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-form">
      <h2 className="text-2xl font-bold text-center mb-2">Create New Password</h2>
      <p className="text-gray-600 text-center mb-6">
        Enter the verification code sent to your email and choose a new password.
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
            disabled={loading || !!initialEmail}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
            Verification Code
          </label>
          <input
            id="verificationCode"
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\s/g, ''))}
            placeholder="Enter 6-digit code"
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-lg tracking-wider"
            maxLength={6}
            autoComplete="off"
          />
          <p className="text-xs text-gray-500 mt-1">Check your email for the verification code</p>
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={loading}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>
          
          {newPassword && (
            <div className="mt-2 text-xs space-y-1">
              <p className={`${isPasswordValid ? 'text-green-600' : 'text-gray-600'}`}>
                Password requirements:
              </p>
              <ul className="space-y-0.5 ml-2">
                {passwordErrors.map((err, index) => (
                  <li key={index} className="text-red-600">✗ {err}</li>
                ))}
                {isPasswordValid && <li className="text-green-600">✓ All requirements met</li>}
              </ul>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="new-password"
          />
          {confirmPassword && !doPasswordsMatch && (
            <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
          )}
          {confirmPassword && doPasswordsMatch && (
            <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !verificationCode || !isPasswordValid || !doPasswordsMatch}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Resetting Password...
            </span>
          ) : (
            'Reset Password'
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
          Didn't receive a code?{' '}
          <a href="/forgot-password" className="text-purple-600 hover:text-purple-800 font-medium">
            Resend code
          </a>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
