import { Component, inject, signal } from '@angular/core';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'wiki-redirecting',
  template: `
    <main style="padding:2rem; text-align:center;">
      @if (failed()) {
        <p>
          Sign-in is unavailable — this looks like a configuration problem.
          Please contact the site administrator.
        </p>
      } @else {
        <p>Redirecting to sign in…</p>
      }
    </main>
  `,
})
export class RedirectingComponent {
  protected readonly failed = signal(false);

  constructor() {
    try {
      // buildAuthorizeUrl() throws OAuthError('config_missing') when Cognito
      // config is empty. A throw in the constructor aborts route activation and
      // the user gets a blank screen, so degrade to a visible fallback instead.
      inject(Auth).redirectToLogin();
    } catch (err) {
      console.error('RedirectingComponent: redirectToLogin() failed', err);
      this.failed.set(true);
    }
  }
}
