import { render } from '@testing-library/angular';
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
});
