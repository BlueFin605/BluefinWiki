import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Auth } from '../../core/auth/auth';
import { isApiError } from '../../core/api/api.types';
import { AdminBackHeader } from '../../shared/components/admin-back-header';

@Component({
  selector: 'wiki-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    AdminBackHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <wiki-admin-back-header title="Profile" />
      </header>
      @if (user(); as u) {
        <mat-card class="card">
          <div class="head">
            <div class="avatar">{{ initial() }}</div>
            <div class="info">
              <div class="name-row">
                <mat-form-field appearance="outline" class="name-field">
                  <mat-label>Display Name</mat-label>
                  <input
                    matInput
                    type="text"
                    [ngModel]="displayNameDraft()"
                    (ngModelChange)="displayNameDraft.set($event)"
                  />
                </mat-form-field>
                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="!canSave() || saving()"
                  (click)="onSave()"
                >
                  Save
                </button>
              </div>
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
      .page-header { display: flex; align-items: center; margin-bottom: 1rem; }
      .card { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
      .head { display: flex; align-items: center; gap: 1rem; }
      .avatar { width: 3.5rem; height: 3.5rem; border-radius: 50%; background: #e3f2fd; color: #1976d2; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 600; }
      .info { flex: 1; }
      .name-row { display: flex; align-items: flex-start; gap: 0.75rem; }
      .name-field { flex: 1; max-width: 320px; }
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
  private readonly snack = inject(MatSnackBar);

  readonly user = this.auth.user;

  protected readonly initial = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const source = u.displayName || u.email || '?';
    return source.charAt(0).toUpperCase();
  });

  protected readonly displayNameDraft = signal('');
  protected readonly saving = signal(false);

  protected readonly canSave = computed(() => {
    const draft = this.displayNameDraft().trim();
    const current = this.user()?.displayName ?? '';
    return draft.length > 0 && draft !== current;
  });

  /**
   * Re-seeds the draft whenever the canonical user changes (initial load,
   * sign-in, or Auth.refreshUser() after a successful save). It does NOT
   * react to local typing, since that only touches displayNameDraft.
   */
  private readonly seedDraft = effect(() => {
    const u = this.user();
    if (u) this.displayNameDraft.set(u.displayName);
  });

  onSignOut(): void {
    this.auth.signOut();
    void this.router.navigate(['/']);
  }

  onSave(): void {
    void this.save();
  }

  private async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    const name = this.displayNameDraft().trim();
    this.saving.set(true);
    try {
      await this.auth.updateProfile(name);
      this.snack.open('Profile updated.', 'Dismiss', { duration: 4000 });
    } catch (err) {
      this.snack.open(this.toMessage(err, 'Failed to update profile.'), 'Dismiss', {
        duration: 4000,
      });
    } finally {
      this.saving.set(false);
    }
  }

  private toMessage(err: unknown, fallback: string): string {
    // The registered errorInterceptor turns every HttpErrorResponse into a plain ApiError
    // object (not an Error instance) before it reaches here, so that's the shape a real
    // 400/500 from PUT /api/auth/profile actually arrives in. `instanceof Error` still
    // covers rejections that never pass through the interceptor (e.g. a thrown JS error).
    if (isApiError(err)) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
  }
}
