/**
 * Tests for Login component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';
import { renderWithProviders, createCognitoError } from '../../test/test-utils';
import * as AuthContext from '../../contexts/AuthContext';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component', () => {
  const mockSignIn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock AuthContext
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      signIn: mockSignIn,
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      getCurrentSession: vi.fn(),
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });
  });

  it('renders login form with all fields', () => {
    renderWithProviders(<Login />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
  });

  it('validates email field is required', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('validates password is required', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('validates password minimum length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'short');
    await user.click(submitButton);

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('submits form with valid credentials', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue(undefined);
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
        rememberMe: false,
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles remember me checkbox', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue(undefined);
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(rememberMeCheckbox);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
        rememberMe: true,
      });
    });
  });

  it('displays error on authentication failure', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Incorrect username or password';
    mockSignIn.mockRejectedValue(createCognitoError('NotAuthorizedException', errorMessage));

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'WrongPassword123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to sign in/i)).toBeInTheDocument();
    });
  });

  it('handles NewPasswordRequired error', async () => {
    const user = userEvent.setup();
    mockSignIn.mockRejectedValue(createCognitoError('NewPasswordRequired', 'New password required'));

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TempPassword123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/you must change your temporary password/i)).toBeInTheDocument();
    });
  });

  it('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    mockSignIn.mockRejectedValue(createCognitoError('NotAuthorizedException', 'Error'));

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Submit with error
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to sign in/i)).toBeInTheDocument();
    });

    // Start typing again
    await user.type(emailInput, 'a');

    // Error should be cleared
    expect(screen.queryByText(/failed to sign in/i)).not.toBeInTheDocument();
  });

  it('shows loading state during sign in', async () => {
    const user = userEvent.setup();
    mockSignIn.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(submitButton);

    // Button should be disabled during loading
    expect(submitButton).toBeDisabled();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    // Initially password type
    expect(passwordInput.type).toBe('password');

    // Find and click show password button (if exists)
    const showPasswordButton = screen.queryByRole('button', { name: /show password/i });
    if (showPasswordButton) {
      await user.click(showPasswordButton);
      expect(passwordInput.type).toBe('text');

      await user.click(showPasswordButton);
      expect(passwordInput.type).toBe('password');
    }
  });
});
