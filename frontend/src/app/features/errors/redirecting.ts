import { Component, inject } from '@angular/core';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'wiki-redirecting',
  template: `<main style="padding:2rem; text-align:center;"><p>Redirecting to sign in…</p></main>`,
})
export class RedirectingComponent {
  constructor() {
    inject(Auth).redirectToLogin();
  }
}
