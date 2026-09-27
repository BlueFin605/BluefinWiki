import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Pages } from './pages';
import type { CreatePageRequest } from './page.types';

export interface CreatePageFromLinkModalData {
  /** Pre-fill / display text for the title field and the warning copy — the
   * link's resolved display text (falls back to the raw target when the
   * link had none). */
  target: string;
  parentGuid: string | null;
  /** The wiki-link's raw `target` (before any `|display` text) — what
   * {@link rewriteWikiLink} must match against in the source markdown after a
   * successful create. Distinct from `target` above whenever the clicked
   * link carried explicit display text (`[[target|text]]`). */
  originalTarget: string;
}

/** Resolved by the modal on a successful create; `null` on cancel. */
export interface CreatePageFromLinkResult {
  newGuid: string;
  linkText: string;
  originalTarget: string;
}

@Component({
  selector: 'wiki-create-page-from-link-modal',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
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

        <mat-checkbox
          name="asRoot"
          [(ngModel)]="asRoot"
          (ngModelChange)="asRoot.set($event)"
        >Create as root page</mat-checkbox>

        @if (!asRoot()) {
          <mat-form-field appearance="fill" class="full">
            <mat-label>Parent page</mat-label>
            <mat-select
              name="parentGuid"
              [(ngModel)]="selectedParentGuid"
              (ngModelChange)="selectedParentGuid.set($event)"
            >
              @if (data.parentGuid) {
                <mat-option [value]="data.parentGuid">Current page</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <p class="hint">Will be created under the current page.</p>
        }

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
    .hint { color: #6b7280; font-size: 0.875rem; margin: 0 0 1rem; }
    .error { color: #b91c1c; margin: 0.5rem 0 0; font-size: 0.875rem; }
  `],
})
export class CreatePageFromLinkModal {
  private readonly dialogRef = inject<MatDialogRef<CreatePageFromLinkModal, CreatePageFromLinkResult | null>>(
    MatDialogRef,
  );
  readonly data = inject<CreatePageFromLinkModalData>(MAT_DIALOG_DATA);
  private readonly pages = inject(Pages);

  protected readonly title = signal(this.data.target);
  protected readonly asRoot = signal(false);
  protected readonly selectedParentGuid = signal<string | null>(this.data.parentGuid);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canSubmit = computed(() => {
    const t = this.title().trim();
    const titleOk = t.length >= 3 && t.length <= 100;
    const parentOk = this.asRoot() || this.selectedParentGuid() !== null;
    return titleOk && parentOk && !this.saving();
  });

  cancel(): void {
    this.dialogRef.close(null);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    const title = this.title().trim();
    const body: CreatePageRequest = {
      title,
      parentGuid: this.asRoot() ? null : this.selectedParentGuid(),
    };
    try {
      const created = await this.pages.createPage(body);
      this.dialogRef.close({
        newGuid: created.guid,
        // The clicked link's own display text (not the — possibly
        // user-edited — title just submitted): `rewriteWikiLink` derives the
        // rewritten display text per matched occurrence on its own, so this
        // is purely informational for the caller (e.g. a confirmation
        // message), not fed into the rewrite.
        linkText: this.data.target,
        originalTarget: this.data.originalTarget,
      });
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Failed to create page.';
      this.errorMessage.set(message);
      this.saving.set(false);
    }
  }
}
