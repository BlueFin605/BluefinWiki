import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Role } from './users';

export interface InvitationCreateResult {
  email?: string;
  role: Role;
  expiryDays: number;
}

@Component({
  selector: 'wiki-invitation-create-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>New Invitation</h2>
    <mat-dialog-content>
      <mat-form-field appearance="fill" class="full">
        <mat-label>Email (optional)</mat-label>
        <input
          matInput
          type="email"
          placeholder="user@example.com"
          [ngModel]="email()"
          (ngModelChange)="email.set($event)"
        />
      </mat-form-field>
      <mat-form-field appearance="fill" class="full">
        <mat-label>Role</mat-label>
        <mat-select [ngModel]="role()" (ngModelChange)="role.set($event)">
          <mat-option value="Standard">Standard</mat-option>
          <mat-option value="Admin">Admin</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="fill" class="full">
        <mat-label>Expires (days)</mat-label>
        <input
          matInput
          type="number"
          min="1"
          max="30"
          [ngModel]="expiryDays()"
          (ngModelChange)="onExpiryDaysChange($event)"
        />
      </mat-form-field>
      @if (expiryDaysError(); as err) {
        <p class="error">{{ err }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="!canSubmit()"
        (click)="confirm()"
      >
        Create
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host { display: block; min-width: 320px; }
      .full { width: 100%; }
      .error { color: #b91c1c; margin: 0.5rem 0 0; font-size: 0.875rem; }
    `,
  ],
})
export class InvitationCreateDialog {
  private readonly dialogRef =
    inject<MatDialogRef<InvitationCreateDialog, InvitationCreateResult | null>>(MatDialogRef);

  protected readonly email = signal('');
  protected readonly role = signal<Role>('Standard');
  protected readonly expiryDays = signal<number | null>(7);

  protected readonly canSubmit = computed(() => {
    const v = this.expiryDays();
    return v !== null && v >= 1 && v <= 30;
  });

  protected readonly expiryDaysError = computed<string | null>(() =>
    this.canSubmit() ? null : 'Enter a number of days between 1 and 30.',
  );

  onExpiryDaysChange(value: number | null): void {
    this.expiryDays.set(value);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  confirm(): void {
    if (!this.canSubmit()) return;
    const trimmedEmail = this.email().trim();
    this.dialogRef.close({
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
      role: this.role(),
      expiryDays: this.expiryDays() as number,
    });
  }
}
