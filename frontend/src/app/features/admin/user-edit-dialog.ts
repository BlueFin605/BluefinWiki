import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Role, UserRecord } from './users';

export interface UserEditDialogData {
  user: UserRecord;
  isSelf: boolean;
}

export interface UserEditDialogResult {
  displayName: string;
  role: Role;
}

@Component({
  selector: 'wiki-user-edit-dialog',
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
    <h2 mat-dialog-title>Edit Member</h2>
    <mat-dialog-content>
      <p class="email">{{ data.user.email }}</p>
      <mat-form-field appearance="fill" class="full">
        <mat-label>Display Name</mat-label>
        <input
          matInput
          type="text"
          [ngModel]="displayName()"
          (ngModelChange)="displayName.set($event)"
          required
        />
      </mat-form-field>
      <mat-form-field appearance="fill" class="full">
        <mat-label>Role</mat-label>
        <mat-select
          [ngModel]="role()"
          (ngModelChange)="role.set($event)"
          [disabled]="data.isSelf"
        >
          <mat-option value="Admin">Admin</mat-option>
          <mat-option value="Standard">Standard</mat-option>
        </mat-select>
      </mat-form-field>
      @if (data.isSelf) {
        <p class="note">You cannot change your own role.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="!displayName().trim()"
        (click)="save()"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host { display: block; min-width: 320px; }
      .full { width: 100%; }
      .email { color: #6b7280; margin: 0 0 0.5rem; font-size: 0.875rem; }
      .note { color: #6b7280; font-size: 0.75rem; }
    `,
  ],
})
export class UserEditDialog {
  protected readonly data = inject<UserEditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<UserEditDialog, UserEditDialogResult | null>>(MatDialogRef);

  protected readonly displayName = signal(this.data.user.displayName);
  protected readonly role = signal<Role>(this.data.user.role);

  cancel(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    const name = this.displayName().trim();
    if (!name) return;
    this.dialogRef.close({ displayName: name, role: this.role() });
  }
}
