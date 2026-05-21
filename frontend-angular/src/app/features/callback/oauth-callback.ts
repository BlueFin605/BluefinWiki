import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'wiki-oauth-callback',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatButtonModule],
  template: `
    @if (error()) {
      <main style="padding:2rem; text-align:center;">
        <h1>Sign in failed</h1>
        <p>{{ error() }}</p>
        <button mat-flat-button color="primary" (click)="retry()">Try again</button>
      </main>
    } @else {
      <main style="padding:2rem; text-align:center;">
        <mat-spinner diameter="40" style="margin:auto"></mat-spinner>
        <p>Completing sign in…</p>
      </main>
    }
  `,
})
export class OAuthCallback {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(Auth);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.complete();
  }

  private async complete(): Promise<void> {
    try {
      const params = this.route.snapshot.queryParamMap;
      const code = params.get('code');
      const state = params.get('state');
      if (!code || !state) throw new Error('Missing authorization code or state in callback URL.');
      await this.auth.completeOAuthCallback(code, state);
      await this.router.navigate(['/pages'], { replaceUrl: true });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Authentication callback failed.');
    }
  }

  retry(): void {
    this.error.set(null);
    this.auth.redirectToLogin();
  }
}
