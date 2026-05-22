import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Pages } from './pages';
import type { CreatePageRequest } from './page.types';

export interface CreatePageFromLinkModalData {
  target: string;
  parentGuid: string | null;
}

@Component({
  selector: 'wiki-create-page-from-link-modal',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Create page from link</h2>
    <mat-dialog-content>
      <p class="warning">
        The page <strong>{{ data.target }}</strong> doesn't exist yet. Create it now?
      </p>
      <form (ngSubmit)="submit()">
        <mat-form-field appearance="fill" class="full">
          <mat-label>Title</mat-label>
          <input
            matInput
            name="title"
            type="text"
            required
            minlength="3"
            maxlength="100"
            [(ngModel)]="title"
            (ngModelChange)="title.set($event)"
          />
        </mat-form-field>

        @if (errorMessage(); as msg) {
          <p class="error">{{ msg }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="!canSubmit()" (click)="submit()">
        @if (saving()) { Creating... } @else { Create }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: 360px; }
    .full { width: 100%; }
    .warning { background: #fef3c7; color: #92400e; padding: 0.5rem 0.75rem; border-radius: 4px; margin: 0 0 1rem; }
    .error { color: #b91c1c; margin: 0.5rem 0 0; font-size: 0.875rem; }
  `],
})
export class CreatePageFromLinkModal {
  private readonly dialogRef = inject<MatDialogRef<CreatePageFromLinkModal, string | null>>(MatDialogRef);
  readonly data = inject<CreatePageFromLinkModalData>(MAT_DIALOG_DATA);
  private readonly pages = inject(Pages);

  protected readonly title = signal(this.data.target);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canSubmit = computed(() => {
    const t = this.title().trim();
    return t.length >= 3 && t.length <= 100 && !this.saving();
  });

  cancel(): void {
    this.dialogRef.close(null);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    const body: CreatePageRequest = {
      title: this.title().trim(),
      parentGuid: this.data.parentGuid,
    };
    try {
      const created = await this.pages.createPage(body);
      this.dialogRef.close(created.guid);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Failed to create page.';
      this.errorMessage.set(message);
      this.saving.set(false);
    }
  }
}
