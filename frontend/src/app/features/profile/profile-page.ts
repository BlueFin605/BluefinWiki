import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'wiki-profile-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <h1>Profile</h1>
      @if (user(); as u) {
        <mat-card class="card">
          <div class="head">
            <div class="avatar">{{ initial() }}</div>
            <div class="info">
              <h2>{{ u.displayName || 'No name set' }}</h2>
              <p class="email">{{ u.email }}</p>
              <p class="role">{{ u.role }}</p>
            </div>
          </div>
          <div class="actions">
            <button mat-flat-button color="warn" type="button" (click)="onSignOut()">
              <mat-icon>logout</mat-icon>
              Sign out
            </button>
          </div>
        </mat-card>
      } @else {
        <p class="state">Not signed in.</p>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .page { padding: 1.5rem; max-width: 640px; margin: 0 auto; }
      .card { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
      .head { display: flex; align-items: center; gap: 1rem; }
      .avatar { width: 3.5rem; height: 3.5rem; border-radius: 50%; background: #e3f2fd; color: #1976d2; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 600; }
      .info h2 { margin: 0; }
      .email { color: #6b7280; margin: 0.25rem 0 0; }
      .role { color: #1976d2; margin: 0.25rem 0 0; font-size: 0.875rem; font-weight: 500; }
      .actions { display: flex; justify-content: flex-start; }
      .state { padding: 1rem; color: #6b7280; }
    `,
  ],
})
export class ProfilePage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly user = this.auth.user;

  protected readonly initial = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const source = u.displayName || u.email || '?';
    return source.charAt(0).toUpperCase();
  });

  onSignOut(): void {
    this.auth.signOut();
    void this.router.navigate(['/']);
  }
}
