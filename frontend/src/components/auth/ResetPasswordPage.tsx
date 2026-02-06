/**
 * Reset Password Page
 * 
 * Entry point for password reset confirmation.
 * Wraps the ResetPassword component with routing.
 */

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ResetPassword from './ResetPassword';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || undefined;

  const handleResetComplete = () => {
    // Navigate to login with success message
    navigate('/login?passwordReset=true');
  };

  const handleCancel = () => {
    navigate('/login');
  };

  return (
    <ResetPassword
      email={email}
      onResetComplete={handleResetComplete}
      onCancel={handleCancel}
    />
  );
};

export default ResetPasswordPage;
