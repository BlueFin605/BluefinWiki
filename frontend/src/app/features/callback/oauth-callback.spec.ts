import { render, screen } from '@testing-library/angular';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { OAuthCallback } from './oauth-callback';

interface SetupOpts {
  code: string | null;
  state: string | null;
  completeBehavior: 'resolve' | 'reject';
}

function makeProviders({ code, state, completeBehavior }: SetupOpts) {
  const queryParamMap = convertToParamMap({
    ...(code !== null ? { code } : {}),
    ...(state !== null ? { state } : {}),
  });
  const auth = {
    completeOAuthCallback: jest
      .fn()
      .mockImplementation(() =>
        completeBehavior === 'resolve' ? Promise.resolve() : Promise.reject(new Error('State mismatch')),
      ),
    redirectToLogin: jest.fn(),
  };
  const router = { navigate: jest.fn().mockResolvedValue(true) };
  return {
    auth,
    router,
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap } } },
      { provide: Auth, useValue: auth },
      { provide: Router, useValue: router },
    ],
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('OAuthCallback', () => {
  it('shows error when code is missing', async () => {
    const { providers } = makeProviders({ code: null, state: 'abc', completeBehavior: 'resolve' });
    await render(OAuthCallback, { providers });
    expect(await screen.findByText(/Sign in failed/)).toBeInTheDocument();
    expect(await screen.findByText(/Missing authorization code/)).toBeInTheDocument();
  });

  it('shows error when state is missing', async () => {
    const { providers } = makeProviders({ code: 'thecode', state: null, completeBehavior: 'resolve' });
    await render(OAuthCallback, { providers });
    expect(await screen.findByText(/Sign in failed/)).toBeInTheDocument();
  });

  it('shows error when completeOAuthCallback rejects', async () => {
    const { providers } = makeProviders({ code: 'thecode', state: 'abc', completeBehavior: 'reject' });
    await render(OAuthCallback, { providers });
    expect(await screen.findByText('State mismatch')).toBeInTheDocument();
  });

  it('navigates to /pages on success', async () => {
    const { providers, auth, router } = makeProviders({ code: 'thecode', state: 'abc', completeBehavior: 'resolve' });
    await render(OAuthCallback, { providers });
    await flushMicrotasks();
    expect(auth.completeOAuthCallback).toHaveBeenCalledWith('thecode', 'abc');
    expect(router.navigate).toHaveBeenCalledWith(['/pages'], { replaceUrl: true });
  });
});
