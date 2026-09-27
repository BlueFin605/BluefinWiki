import { render, screen } from '@testing-library/angular';
import { Auth } from '../../core/auth/auth';
import { RedirectingComponent } from './redirecting';

describe('RedirectingComponent', () => {
  it('calls redirectToLogin on construction', async () => {
    const redirectToLogin = jest.fn();
    await render(RedirectingComponent, {
      providers: [{ provide: Auth, useValue: { redirectToLogin } }],
    });
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('shows the redirecting copy on a normal render', async () => {
    await render(RedirectingComponent, {
      providers: [{ provide: Auth, useValue: { redirectToLogin: jest.fn() } }],
    });
    expect(screen.getByText(/redirecting to sign in/i)).toBeInTheDocument();
  });

  it('renders a visible fallback when redirectToLogin throws', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const redirectToLogin = jest.fn(() => {
      throw new Error('config_missing');
    });

    // Must not throw out of render (a constructor throw would abort the route).
    await render(RedirectingComponent, {
      providers: [{ provide: Auth, useValue: { redirectToLogin } }],
    });

    expect(screen.getByText(/sign-in is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/redirecting to sign in/i)).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
