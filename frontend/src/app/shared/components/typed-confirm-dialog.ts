import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface TypedConfirmDialogData {
  /** The page title the user must type to enable Delete. */
  title: string;
  message: string;
}

@Component({
  selector: 'wiki-typed-confirm-dialog',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Delete page</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>Type "{{ data.title }}" to confirm</mat-label>
        <input
          matInput
          type="text"
          autocomplete="off"
          [ngModel]="typed()"
          (ngModelChange)="typed.set($event)"
          (keydown.enter)="matches() && confirm()"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button
        mat-flat-button
        type="button"
        color="warn"
        [disabled]="!matches()"
        (click)="confirm()"
      >
        Delete
      </button>
    </mat-dialog-actions>
  `,
})
export class TypedConfirmDialog {
  protected readonly data = inject<TypedConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TypedConfirmDialog, boolean>>(MatDialogRef);

  protected readonly typed = signal('');
  protected readonly matches = computed(
    () => this.typed().trim().toLowerCase() === this.data.title.trim().toLowerCase(),
  );

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    if (this.matches()) this.dialogRef.close(true);
  }
}
