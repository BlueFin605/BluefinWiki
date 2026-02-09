/**
 * Forgot Password Page
 * 
 * Entry point for password reset flow.
 * Wraps the ForgotPassword component with routing.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const handleResetRequested = (requestedEmail: string) => {
    // Navigate to reset password page with email
    navigate(`/reset-password?email=${encodeURIComponent(requestedEmail)}`);
  };

  const handleCancel = () => {
    navigate('/login');
  };

  return (
    <ForgotPassword
      onResetRequested={handleResetRequested}
      onCancel={handleCancel}
    />
  );
};

export default ForgotPasswordPage;
