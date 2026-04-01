import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface PermissionGuardProps {
  requiredRole: 'Admin';
  children: React.ReactNode;
}

/**
 * Route wrapper that restricts access by role.
 * Shows a 403 page for non-admins, redirects unauthenticated users to login.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({ requiredRole, children }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    // AuthGate handles redirect to login — this is a fallback
    return null;
  }

  if (user.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900">403</h1>
          <p className="text-xl text-gray-600 mt-4">You don't have permission to access this page</p>
          <a
            href="/pages"
            className="mt-8 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Pages
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
