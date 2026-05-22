import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Pages } from './pages';
import { PageTypes, SKIP_PAGE_TYPE_FETCH } from '../page-types/page-types';
import type { CreatePageRequest } from './page.types';

export interface NewPageModalData {
  parentGuid: string | null;
  parentTitle?: string;
  parentPageType?: string | null;
}

@Component({
  selector: 'wiki-new-page-modal',
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
    <h2 mat-dialog-title>New page</h2>
    <mat-dialog-content>
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

        <mat-form-field appearance="fill" class="full">
          <mat-label>Description</mat-label>
          <input
            matInput
            name="description"
            type="text"
            [(ngModel)]="description"
            (ngModelChange)="description.set($event)"
          />
        </mat-form-field>

        <div class="parent">
          <strong>Parent:</strong>
          <span>{{ parentLabel() }}</span>
        </div>

        @if (availableTypes().length > 0) {
          <mat-form-field appearance="fill" class="full">
            <mat-label>Page type</mat-label>
            <mat-select [(ngModel)]="pageType" name="pageType" (ngModelChange)="pageType.set($event)">
              <mat-option [value]="null">(none)</mat-option>
              @for (t of availableTypes(); track t.guid) {
                <mat-option [value]="t.guid">{{ t.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
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
    .parent { padding: 0.5rem 0; color: #6b7280; font-size: 0.875rem; }
    .error { color: #b91c1c; margin: 0.5rem 0 0; font-size: 0.875rem; }
  `],
})
export class NewPageModal {
  private readonly dialogRef = inject<MatDialogRef<NewPageModal, string | null>>(MatDialogRef);
  readonly data = inject<NewPageModalData>(MAT_DIALOG_DATA);
  private readonly pages = inject(Pages);
  private readonly pageTypes = inject(PageTypes);

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly pageType = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Resources: if the parent has a page type, fetch its allowed children;
  // otherwise fetch the full set of page types. (Even with no parent page
  // type, this gives the user the full list — matches React behaviour.)
  private readonly parentTypeSignal = signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>(
    this.data.parentPageType ?? SKIP_PAGE_TYPE_FETCH,
  );
  private readonly allowedResource = this.pageTypes.allowedChildTypesResource(this.parentTypeSignal);
  private readonly allTypesResource = this.pageTypes.pageTypesResource();

  protected readonly availableTypes = computed(() => {
    if (this.data.parentPageType) {
      if (this.allowedResource.status() === 'resolved') {
        return this.allowedResource.value()?.allowedChildTypes ?? [];
      }
      return [];
    }
    if (this.allTypesResource.status() === 'resolved') {
      return this.allTypesResource.value() ?? [];
    }
    return [];
  });

  protected readonly parentLabel = computed(() => this.data.parentTitle ?? 'Root');

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
      ...(this.description() ? { description: this.description() } : {}),
      ...(this.pageType() ? { pageType: this.pageType() ?? undefined } : {}),
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
