import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
          (ngModelChange)="expiryDays.set($event)"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="confirm()">
        Create
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host { display: block; min-width: 320px; }
      .full { width: 100%; }
    `,
  ],
})
export class InvitationCreateDialog {
  private readonly dialogRef =
    inject<MatDialogRef<InvitationCreateDialog, InvitationCreateResult | null>>(MatDialogRef);

  protected readonly email = signal('');
  protected readonly role = signal<Role>('Standard');
  protected readonly expiryDays = signal(7);

  cancel(): void {
    this.dialogRef.close(null);
  }

  confirm(): void {
    const trimmedEmail = this.email().trim();
    const expiry = Number(this.expiryDays()) || 7;
    this.dialogRef.close({
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
      role: this.role(),
      expiryDays: expiry,
    });
  }
}
