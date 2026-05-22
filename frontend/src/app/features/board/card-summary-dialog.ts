import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { PageChildDetail, PageTypeDefinition } from '../pages/page.types';

export interface CardSummaryDialogData {
  card: PageChildDetail;
  pageType: PageTypeDefinition | null;
}

interface PropertyRow {
  name: string;
  value: string;
}

/**
 * Read-only Material dialog showing a board card's metadata. Phase 5
 * doesn't support inline editing here — that's the React `CardSummaryDialog`
 * behaviour and is deferred to a polish pass.
 */
@Component({
  selector: 'wiki-card-summary-dialog',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.pageType?.icon; as icon) {
        <span class="type-icon" [attr.title]="data.pageType?.name">{{ icon }}</span>
      }
      <span>{{ data.card.title }}</span>
    </h2>
    <mat-dialog-content>
      @if (data.pageType; as pt) {
        <p class="type-line"><span class="muted">Type:</span> {{ pt.name }}</p>
      }
      @if (data.card.parentTitle; as parent) {
        <p class="parent-line"><span class="muted">In:</span> {{ parent }}</p>
      }
      @if (propertyRows().length > 0) {
        <dl class="properties">
          @for (row of propertyRows(); track row.name) {
            <dt>{{ row.name }}</dt>
            <dd>{{ row.value }}</dd>
          }
        </dl>
      } @else {
        <p class="muted">No custom properties.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a mat-button [routerLink]="['/pages', data.card.guid]" (click)="onOpen()">Open page</a>
      <button mat-button type="button" (click)="onClose()">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: 360px; }
    .type-icon { margin-right: 0.5rem; font-size: 1.25rem; }
    .type-line, .parent-line { margin: 0 0 0.5rem; font-size: 0.875rem; }
    .muted { color: #6b7280; margin-right: 0.25rem; }
    .properties { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 0.75rem; margin: 0.5rem 0 0; font-size: 0.875rem; }
    dt { color: #6b7280; font-weight: 500; }
    dd { color: #111827; margin: 0; }
  `],
})
export class CardSummaryDialog {
  readonly data = inject<CardSummaryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CardSummaryDialog>>(MatDialogRef);

  protected readonly propertyRows = computed<PropertyRow[]>(() => {
    const props = this.data.card.properties;
    if (!props) return [];
    return Object.entries(props).map(([name, prop]) => ({
      name,
      value: Array.isArray(prop.value) ? prop.value.join(', ') : String(prop.value),
    }));
  });

  onClose(): void {
    this.dialogRef.close();
  }

  onOpen(): void {
    this.dialogRef.close();
  }
}
