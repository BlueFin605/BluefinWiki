/**
 * Tests for ProtectedRoute component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import * as AuthContext from '../../contexts/AuthContext';
import { render } from '@testing-library/react';
import { mockAuthenticatedUser, mockAdminUser } from '../../test/test-utils';

// Mock component to test protected content
const TestProtectedContent = () => <div>Protected Content</div>;
const TestLoginPage = () => <div>Login Page</div>;

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while checking authentication', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      getCurrentSession: vi.fn(),
      user: null,
      isLoading: true,
      error: null,
      isAuthenticated: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestProtectedContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
    expect(screen.queryByText(/protected content/i)).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      getCurrentSession: vi.fn(),
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestProtectedContent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<TestLoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/login page/i)).toBeInTheDocument();
    expect(screen.queryByText(/protected content/i)).not.toBeInTheDocument();
  });

  it('renders protected content for authenticated users', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      getCurrentSession: vi.fn(),
      user: mockAuthenticatedUser,
      isLoading: false,
      error: null,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestProtectedContent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<TestLoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    expect(screen.queryByText(/login page/i)).not.toBeInTheDocument();
  });

  it('shows access denied for non-admin users when requireAdmin is true', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      getCurrentSession: vi.fn(),
      user: mockAuthenticatedUser, // Standard user, not admin
      isLoading: false,
      error: null,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <TestProtectedContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.getByText(/admin privileges are required/i)).toBeInTheDocument();
    expect(screen.queryByText(/protected content/i)).not.toBeInTheDocument();
  });

  it('renders protected content for admin users when requireAdmin is true', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      getCurrentSession: vi.fn(),
      user: mockAdminUser,
      isLoading: false,
      error: null,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <TestProtectedContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
  });

  it('allows admin users to access non-admin protected routes', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      getCurrentSession: vi.fn(),
      user: mockAdminUser,
      isLoading: false,
      error: null,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute requireAdmin={false}>
                <TestProtectedContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/protected content/i)).toBeInTheDocument();
  });

  it('preserves location state for redirect after login', () => {
    const mockLocation = { pathname: '/protected', state: null };
    
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      getCurrentSession: vi.fn(),
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });

    render(
      <MemoryRouter initialEntries={[mockLocation]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestProtectedContent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<TestLoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to login
    expect(screen.getByText(/login page/i)).toBeInTheDocument();
  });
});
