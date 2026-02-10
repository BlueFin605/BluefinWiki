/**
 * Tests for Register component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Register from './Register';
import { renderWithProviders } from '../../test/test-utils';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockAxios = axios as any;

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
  };
});

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form with all fields', () => {
    renderWithProviders(<Register />);

    expect(screen.getByLabelText(/invitation code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/accept.*terms/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('validates invitation code is required', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    expect(await screen.findByText(/invitation code is required/i)).toBeInTheDocument();
  });

  it('validates invitation code length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'SHORT');
    await user.click(submitButton);

    expect(await screen.findByText(/invitation code must be 8 characters/i)).toBeInTheDocument();
  });

  it('validates email is required', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.click(submitButton);

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('validates form fields sequentially', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Test that validation checks fields in order
    // First check: invitation code required
    await user.click(submitButton);
    expect(await screen.findByText(/invitation code is required/i)).toBeInTheDocument();

    // Fill invite code, now email required
    await user.type(inviteInput, 'INVITE12');
    await user.click(submitButton);
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();

    // Fill email, now display name required
    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);
    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument();

    // Fill display name with minimum length, now password required
    await user.type(displayNameInput, 'Test User');
    await user.click(submitButton);
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('validates display name minimum length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'a'); // Only 1 character
    await user.click(submitButton);

    expect(await screen.findByText(/display name must be at least 2 characters/i)).toBeInTheDocument();
  });

  it('validates password complexity - lowercase requirement', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'PASSWORD1!');
    await user.type(confirmPasswordInput, 'PASSWORD1!');
    await user.click(submitButton);
    
    expect(await screen.findByText(/must contain at least one lowercase letter/i)).toBeInTheDocument();
  });

  it('validates password complexity - uppercase requirement', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'password1!');
    await user.type(confirmPasswordInput, 'password1!');
    await user.click(submitButton);
    
    expect(await screen.findByText(/must contain at least one uppercase letter/i)).toBeInTheDocument();
  });

  it('validates password complexity - number requirement', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'Password!');
    await user.type(confirmPasswordInput, 'Password!');
    await user.click(submitButton);
    
    expect(await screen.findByText(/must contain at least one number/i)).toBeInTheDocument();
  });

  it('validates password complexity - special character requirement', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'Password1');
    await user.type(confirmPasswordInput, 'Password1');
    await user.click(submitButton);
    
    expect(await screen.findByText(/must contain at least one special character/i)).toBeInTheDocument();
  });

  it('validates passwords match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password456!');
    await user.click(submitButton);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('validates terms acceptance', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');
    await user.click(submitButton);

    expect(await screen.findByText(/you must accept the terms and conditions/i)).toBeInTheDocument();
  });

  it('submits registration with valid data', async () => {
    const user = userEvent.setup();
    mockAxios.post.mockResolvedValue({ data: { success: true, userId: 'test-user-id' } });

    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByLabelText(/accept.*terms/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');
    await user.click(termsCheckbox);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        {
          email: 'test@example.com',
          displayName: 'Test User',
          password: 'Password123!',
          inviteCode: 'INVITE12',
        }
      );
    });
  });

  it('displays password strength indicator', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const passwordInput = screen.getByLabelText(/^password/i);

    // Weak password
    await user.type(passwordInput, 'pass');
    expect(await screen.findByText(/weak/i)).toBeInTheDocument();

    await user.clear(passwordInput);

    // Strong password
    await user.type(passwordInput, 'Password123!');
    expect(await screen.findByText(/strong|good/i)).toBeInTheDocument();
  });

  it('handles registration API errors', async () => {
    const user = userEvent.setup();
    mockAxios.post.mockRejectedValue({
      response: {
        data: { message: 'Invalid invitation code' },
      },
    });

    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByLabelText(/accept.*terms/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVALID1');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');
    await user.click(termsCheckbox);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid invitation code/i)).toBeInTheDocument();
    });
  });

  it('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Submit to trigger error
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invitation code is required/i)).toBeInTheDocument();
    });

    // Start typing in invite code field
    await user.type(inviteInput, 'I');

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/invitation code is required/i)).not.toBeInTheDocument();
    });
  });

  it('shows loading state during registration', async () => {
    const user = userEvent.setup();
    mockAxios.post.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    renderWithProviders(<Register />);

    const inviteInput = screen.getByLabelText(/invitation code/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const displayNameInput = screen.getByLabelText(/display name/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByLabelText(/accept.*terms/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(inviteInput, 'INVITE12');
    await user.type(emailInput, 'test@example.com');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');
    await user.click(termsCheckbox);
    await user.click(submitButton);

    // Button should be disabled during loading
    expect(submitButton).toBeDisabled();
  });
});
