import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CustomPropertiesEditor } from '../editor/custom-properties-editor';
import { mergeSchema } from '../pages/merge-schema';
import { Pages } from '../pages/pages';
import type { PageChildDetail, PageProperty, PageTypeDefinition } from '../pages/page.types';

export interface CardSummaryDialogData {
  card: PageChildDetail;
  pageType: PageTypeDefinition | null;
}

/**
 * `Array.isArray` value comparison for one property's stored value — array
 * values (tags) compare elementwise, everything else by strict equality.
 */
function valueEqual(a: PageProperty['value'], b: PageProperty['value']): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/** Whole-property-set equality for the dirty check — same keys, same type + value each. */
function propertiesEqual(
  a: Record<string, PageProperty>,
  b: Record<string, PageProperty>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => {
    const bv = b[key];
    return bv !== undefined && a[key].type === bv.type && valueEqual(a[key].value, bv.value);
  });
}

/**
 * Board card inline-edit dialog (step 5.7, React `CardSummaryDialog` parity):
 * edit **title + properties inline** using the same per-type editors as the
 * inspector ({@link CustomPropertiesEditor}, text/number/date/tags-with-vocab,
 * step 4.7), then `PUT /pages/:cardGuid { title, properties }` on Save — the
 * merged property set going out is built with {@link mergeSchema} (step 4.4)
 * so a schema field the card never had gets its default persisted alongside
 * any hand-edited values.
 *
 * Self-contained: `updatePage` (step 1.2) already bumps
 * `children:<parentGuid>` + `children:any` whenever `title`/`properties` are
 * in the body, so the board's own resource picks up the change with no
 * output from this dialog. `Esc` / backdrop close are Material's own
 * `MatDialogModule` defaults — nothing here overrides them.
 */
@Component({
  selector: 'wiki-card-summary-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    CustomPropertiesEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.pageType?.icon; as icon) {
        <span class="type-icon" [attr.title]="data.pageType?.name">{{ icon }}</span>
      }
      <span>{{ title() || 'Untitled' }}</span>
    </h2>
    <mat-dialog-content>
      @if (data.pageType; as pt) {
        <p class="type-line"><span class="muted">Type:</span> {{ pt.name }}</p>
      }
      @if (data.card.parentTitle; as parent) {
        <p class="parent-line"><span class="muted">In:</span> {{ parent }}</p>
      }

      <mat-form-field appearance="fill" class="full">
        <mat-label>Title</mat-label>
        <input
          matInput
          type="text"
          [ngModel]="title()"
          (ngModelChange)="title.set($event)"
        />
      </mat-form-field>

      <wiki-custom-properties-editor
        [pageType]="data.pageType"
        [properties]="properties()"
        (propertiesChange)="properties.set($event)"
      />

      @if (errorMessage(); as msg) {
        <p class="error" role="alert">{{ msg }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="onOpenFullEditor()">Open full editor</button>
      <button mat-button type="button" (click)="onClose()">Close</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="!canSave()"
        (click)="onSave()"
      >
        @if (saving()) { Saving… } @else { Save }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: 360px; }
    .type-icon { margin-right: 0.5rem; font-size: 1.25rem; }
    .type-line, .parent-line { margin: 0 0 0.5rem; font-size: 0.875rem; }
    .muted { color: #6b7280; margin-right: 0.25rem; }
    .full { width: 100%; }
    .error { color: #b91c1c; margin: 0.5rem 0 0; font-size: 0.875rem; }
  `],
})
export class CardSummaryDialog {
  readonly data = inject<CardSummaryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CardSummaryDialog>>(MatDialogRef);
  private readonly pages = inject(Pages);

  /** Snapshot of the schema-merged property set as opened — the dirty-check baseline. */
  private readonly initialTitle = this.data.card.title;
  private readonly initialProperties = mergeSchema(
    this.data.card.properties,
    this.data.pageType?.properties ?? [],
  );

  protected readonly title = signal(this.initialTitle);
  protected readonly properties = signal<Record<string, PageProperty>>(this.initialProperties);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly dirty = computed(
    () => this.title() !== this.initialTitle || !propertiesEqual(this.properties(), this.initialProperties),
  );

  protected readonly canSave = computed(
    () => this.dirty() && this.title().trim() !== '' && !this.saving(),
  );

  onClose(): void {
    this.dialogRef.close();
  }

  onOpenFullEditor(): void {
    window.open('/pages/' + this.data.card.guid, '_blank');
  }

  async onSave(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    const schema = this.data.pageType?.properties ?? [];
    const merged = mergeSchema(this.properties(), schema);
    try {
      await this.pages.updatePage(this.data.card.guid, {
        title: this.title().trim(),
        properties: merged,
      });
      this.dialogRef.close();
    } catch (err) {
      this.errorMessage.set(this.toMessage(err));
      this.saving.set(false);
    }
  }

  private toMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const m = (err as { message?: unknown }).message;
      if (typeof m === 'string') return m;
    }
    return 'Something went wrong.';
  }
}
