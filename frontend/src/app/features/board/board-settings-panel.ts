import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { BoardConfig, PageTypeDefinition } from '../pages/page.types';

export interface BoardSettingsPanelData {
  config: BoardConfig | null;
  pageTypes: PageTypeDefinition[];
}

const COLOR_PALETTE = [
  '#6b7280',
  '#3b82f6',
  '#22c55e',
  '#ef4444',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

/**
 * Material dialog that lets the user edit a page's `BoardConfig` —
 * columns, colours, default view, target type for deep boards, etc.
 * Closes with the new config (or `null` on cancel).
 */
@Component({
  selector: 'wiki-board-settings-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Board settings</h2>
    <mat-dialog-content>
      <section class="section">
        <h3>Columns</h3>
        @if (columns().length === 0) {
          <p class="muted">No columns configured — they will be derived from state values automatically.</p>
        }
        <ul class="columns">
          @for (col of columns(); let i = $index; track col) {
            <li>
              <button
                type="button"
                class="dot"
                [style.background-color]="colors()[col] ?? '#6b7280'"
                (click)="toggleColorPicker(col)"
                [attr.aria-label]="'Change colour for ' + col"
              ></button>
              @if (editingColor() === col) {
                <div class="palette">
                  @for (c of palette; track c) {
                    <button
                      type="button"
                      class="swatch"
                      [style.background-color]="c"
                      (click)="setColumnColor(col, c)"
                      [attr.aria-label]="'Use colour ' + c"
                    ></button>
                  }
                </div>
              }
              <span class="col-name">{{ col }}</span>
              <button
                mat-icon-button
                type="button"
                [disabled]="i === 0"
                (click)="moveColumn(i, -1)"
                aria-label="Move column up"
              >
                <mat-icon>arrow_upward</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                [disabled]="i === columns().length - 1"
                (click)="moveColumn(i, 1)"
                aria-label="Move column down"
              >
                <mat-icon>arrow_downward</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                (click)="removeColumn(col)"
                [attr.aria-label]="'Remove column ' + col"
              >
                <mat-icon>close</mat-icon>
              </button>
            </li>
          }
        </ul>
        <div class="add-column">
          <mat-form-field appearance="fill" class="add-input">
            <mat-label>New column</mat-label>
            <input
              matInput
              type="text"
              [ngModel]="newColumn()"
              (ngModelChange)="newColumn.set($event)"
              (keydown.enter)="addColumn(); $event.preventDefault()"
            />
          </mat-form-field>
          <button mat-button type="button" (click)="addColumn()" [disabled]="!canAddColumn()">Add</button>
        </div>
      </section>

      <section class="section">
        <h3>Default view</h3>
        <mat-button-toggle-group
          [value]="defaultView()"
          (change)="defaultView.set($event.value)"
          aria-label="Default view"
        >
          <mat-button-toggle value="content">Content</mat-button-toggle>
          <mat-button-toggle value="board">Board</mat-button-toggle>
        </mat-button-toggle-group>
      </section>

      <section class="section">
        <h3>Collect pages of type</h3>
        <mat-form-field appearance="fill" class="full">
          <mat-label>Target type</mat-label>
          <mat-select
            [value]="targetTypeGuid()"
            (selectionChange)="targetTypeGuid.set($event.value)"
          >
            <mat-option [value]="''">(Direct children)</mat-option>
            @for (pt of data.pageTypes; track pt.guid) {
              <mat-option [value]="pt.guid">{{ pt.icon }} {{ pt.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (targetTypeGuid()) {
          <mat-form-field appearance="fill" class="depth-input">
            <mat-label>Depth</mat-label>
            <input
              matInput
              type="number"
              min="1"
              max="10"
              [ngModel]="depth()"
              (ngModelChange)="depth.set($event)"
            />
          </mat-form-field>
        }
      </section>

      <section class="section">
        <mat-slide-toggle
          [checked]="showParentTitle()"
          (change)="showParentTitle.set($event.checked)"
        >Show parent title on cards</mat-slide-toggle>
        <mat-slide-toggle
          [checked]="swapTitles()"
          (change)="swapTitles.set($event.checked)"
        >Use parent as primary title</mat-slide-toggle>
      </section>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="onCancel()">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="onSave()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: 460px; max-width: 540px; }
    .section { margin-bottom: 1.25rem; }
    .section h3 { font-size: 0.875rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem; }
    .muted { color: #6b7280; font-size: 0.8125rem; margin: 0 0 0.5rem; }
    .full { width: 100%; }
    .columns { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
    .columns li { display: flex; align-items: center; gap: 0.5rem; position: relative; }
    .dot { width: 1.25rem; height: 1.25rem; border-radius: 9999px; border: 1px solid #d1d5db; cursor: pointer; background: #6b7280; padding: 0; }
    .col-name { flex: 1; font-size: 0.875rem; color: #374151; }
    .palette {
      position: absolute;
      left: 0;
      top: 1.6rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.375rem;
      display: flex;
      gap: 0.25rem;
      z-index: 10;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .swatch { width: 1.25rem; height: 1.25rem; border-radius: 9999px; border: 1px solid #e5e7eb; cursor: pointer; padding: 0; }
    .add-column { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
    .add-input { flex: 1; }
    .depth-input { width: 100px; margin-left: 0.5rem; }
    mat-slide-toggle { display: block; margin: 0.25rem 0; }
  `],
})
export class BoardSettingsPanel {
  readonly data = inject<BoardSettingsPanelData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<BoardSettingsPanel, BoardConfig | null>>(MatDialogRef);

  protected readonly palette = COLOR_PALETTE;

  protected readonly columns = signal<string[]>([...(this.data.config?.columns ?? [])]);
  protected readonly colors = signal<Record<string, string>>({ ...(this.data.config?.colors ?? {}) });
  protected readonly defaultView = signal<'content' | 'board'>(this.data.config?.defaultView ?? 'content');
  protected readonly targetTypeGuid = signal<string>(this.data.config?.targetTypeGuid ?? '');
  protected readonly depth = signal<number>(this.data.config?.depth ?? 10);
  protected readonly showParentTitle = signal<boolean>(this.data.config?.showParentTitle ?? true);
  protected readonly swapTitles = signal<boolean>(this.data.config?.swapTitles ?? false);
  protected readonly newColumn = signal<string>('');
  protected readonly editingColor = signal<string | null>(null);

  protected readonly canAddColumn = computed(() => {
    const name = this.newColumn().trim();
    return name.length > 0 && !this.columns().includes(name);
  });

  addColumn(): void {
    if (!this.canAddColumn()) return;
    const name = this.newColumn().trim();
    this.columns.update((cols) => [...cols, name]);
    this.newColumn.set('');
  }

  removeColumn(name: string): void {
    this.columns.update((cols) => cols.filter((c) => c !== name));
    this.colors.update((colors) => {
      const next = { ...colors };
      delete next[name];
      return next;
    });
  }

  moveColumn(index: number, direction: -1 | 1): void {
    const target = index + direction;
    this.columns.update((cols) => {
      if (target < 0 || target >= cols.length) return cols;
      const next = [...cols];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  toggleColorPicker(col: string): void {
    this.editingColor.update((cur) => (cur === col ? null : col));
  }

  setColumnColor(col: string, color: string): void {
    this.colors.update((colors) => ({ ...colors, [col]: color }));
    this.editingColor.set(null);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSave(): void {
    const next: BoardConfig = {};
    if (this.columns().length > 0) next.columns = [...this.columns()];
    if (Object.keys(this.colors()).length > 0) next.colors = { ...this.colors() };
    if (this.targetTypeGuid()) {
      next.targetTypeGuid = this.targetTypeGuid();
      next.depth = this.depth();
      next.showParentTitle = this.showParentTitle();
      if (this.swapTitles()) next.swapTitles = true;
    }
    if (this.defaultView() === 'board') next.defaultView = 'board';
    this.dialogRef.close(next);
  }
}
