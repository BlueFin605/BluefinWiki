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
import { MatSnackBar } from '@angular/material/snack-bar';
import { boardableTypes } from './boardable-types';
import { configuredTypeGuids, leafTypes } from './card-types';
import type { BoardGroup } from './board-defaults';
import type { BoardConfig, PageTypeDefinition } from '../pages/page.types';
import { KEY_PREFIX_PATTERN } from '../ticket-keys/ticket-key';
import { TicketKeys } from '../ticket-keys/ticket-keys';

export interface BoardSettingsPanelData {
  config: BoardConfig | null;
  pageTypes: PageTypeDefinition[];
  /** The page's type, when it has one — enables Reset / Save as default. */
  type?: { name: string; icon: string; hasDefaults: boolean; canEdit: boolean } | null;
  /** Groups this page overrides (only set when the type has defaults). */
  overridden?: BoardGroup[];
  /**
   * Set only for Initiative pages — enables the ticket key prefix field
   * (page-only, never a type default) and, for Admins, the backfill button.
   */
  ticketKeys?: { pageGuid: string; canBackfill: boolean } | null;
}

export interface BoardSettingsResult {
  action: 'save' | 'reset' | 'saveAsDefault';
  config: BoardConfig;
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
      @if (data.ticketKeys) {
        <section class="section" data-testid="ticket-key-section">
          <h3>Ticket keys</h3>
          <div class="ticket-keys">
            <mat-form-field appearance="fill" class="prefix-input" subscriptSizing="dynamic">
              <mat-label>Ticket key prefix</mat-label>
              <input
                matInput
                type="text"
                maxlength="10"
                [pattern]="prefixPattern"
                [ngModel]="keyPrefix()"
                (ngModelChange)="keyPrefix.set($event.toUpperCase())"
                aria-label="Ticket key prefix"
              />
              <mat-hint>e.g. BGT → tickets get BGT-1, BGT-2…</mat-hint>
              @if (keyPrefixInvalid()) { <mat-error>2–10 letters/digits, starting with a letter</mat-error> }
            </mat-form-field>
            @if (data.ticketKeys.canBackfill) {
              <button
                mat-stroked-button
                type="button"
                [disabled]="!savedPrefix || backfilling()"
                (click)="onBackfill()"
              >Assign keys to existing tickets</button>
            }
          </div>
        </section>
      }
      <section class="section">
        <h3>Columns @if (isOverridden('columns', 'colors')) { <span class="overridden">overridden</span> }</h3>
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
        <h3>Default view @if (isOverridden('defaultView')) { <span class="overridden">overridden</span> }</h3>
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
        <h3>Collect pages of @if (isOverridden('cards', 'depth')) { <span class="overridden">overridden</span> }</h3>
        <mat-button-toggle-group
          [value]="cardMode()"
          (change)="cardMode.set($event.value)"
          aria-label="Collect pages of"
        >
          <mat-button-toggle value="children">Direct children</mat-button-toggle>
          <mat-button-toggle value="leaves" [disabled]="boardableTypeOptions().length === 0">Leaf types</mat-button-toggle>
          <mat-button-toggle value="types" [disabled]="boardableTypeOptions().length === 0">Specific types</mat-button-toggle>
        </mat-button-toggle-group>
        @if (boardableTypeOptions().length === 0) {
          <p class="muted">No page types define a "state" property — nothing to collect from descendants.</p>
        }
        @if (cardMode() === 'leaves') {
          <p class="muted">
            @if (leafSummary()) { Currently: {{ leafSummary() }} } @else { No leaf types yet. }
          </p>
        }
        @if (cardMode() === 'types') {
          <mat-form-field appearance="fill" class="full">
            <mat-label>Page types</mat-label>
            <mat-select multiple [value]="targetTypeGuids()" (selectionChange)="targetTypeGuids.set($event.value)">
              @for (pt of boardableTypeOptions(); track pt.guid) {
                <mat-option [value]="pt.guid">{{ pt.icon }} {{ pt.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @if (typedBoard()) {
          <mat-form-field appearance="fill" class="depth-input">
            <mat-label>Depth</mat-label>
            <input matInput type="number" min="1" max="10" [ngModel]="depth()" (ngModelChange)="depth.set($event)" />
          </mat-form-field>
        }
      </section>

      <!-- Only deep boards populate card.parentTitle, so only offer these for typed
           boards. Direct-children mode omits them (see buildConfig). -->
      @if (typedBoard()) {
        <section class="section">
          <h3>Cards @if (isOverridden('showParentTitle', 'swapTitles')) { <span class="overridden">overridden</span> }</h3>
          <mat-slide-toggle
            [checked]="showParentTitle()"
            (change)="showParentTitle.set($event.checked)"
          >Show parent title on cards</mat-slide-toggle>
          <mat-slide-toggle
            [checked]="swapTitles()"
            (change)="swapTitles.set($event.checked)"
          >Use parent as primary title</mat-slide-toggle>
        </section>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (canReset()) {
        <button mat-button type="button" (click)="onReset()">Reset to {{ data.type!.icon }} {{ data.type!.name }} default</button>
      }
      @if (canSaveAsDefault()) {
        <button mat-stroked-button type="button" [disabled]="keyPrefixInvalid()" (click)="onSaveAsDefault()">Save as default for {{ data.type!.icon }} {{ data.type!.name }} pages</button>
      }
      <span class="spacer"></span>
      <button mat-button type="button" (click)="onCancel()">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="keyPrefixInvalid()" (click)="onSave()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    /* 460px wide on desktop; on a phone, the dialog surface minus its padding. */
    :host { display: block; min-width: min(460px, calc(100vw - 96px)); max-width: 540px; }
    /* Toggle rows share the width and wrap their labels rather than overflow. */
    mat-button-toggle-group { display: inline-flex; max-width: 100%; }
    mat-button-toggle { flex: 1 1 auto; min-width: 0; }
    :host ::ng-deep .mat-button-toggle-label-content { white-space: normal; line-height: 1.2; padding-top: 0.375rem; padding-bottom: 0.375rem; }
    .section { margin-bottom: 1.25rem; }
    .section h3 { font-size: 0.875rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem; }
    .muted { color: #6b7280; font-size: 0.8125rem; margin: 0 0 0.5rem; }
    .full { width: 100%; }
    .overridden { font-size: 0.6875rem; font-weight: 500; color: #92400e; background: #fef3c7; border-radius: 9999px; padding: 0.0625rem 0.375rem; margin-left: 0.375rem; }
    .spacer { flex: 1; }
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
    .ticket-keys { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.5rem 1rem; }
    .prefix-input { width: 15rem; max-width: 100%; }
    .ticket-keys button { margin-top: 0.5rem; }
  `],
})
export class BoardSettingsPanel {
  readonly data = inject<BoardSettingsPanelData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<BoardSettingsPanel, BoardSettingsResult | null>>(MatDialogRef);
  private readonly ticketKeys = inject(TicketKeys);
  private readonly snack = inject(MatSnackBar);

  protected readonly keyPrefix = signal<string>(this.data.config?.keyPrefix ?? '');
  /** Backfill needs the prefix already stored on the page, not just typed. */
  protected readonly savedPrefix = !!this.data.config?.keyPrefix;
  protected readonly keyPrefixInvalid = computed(
    () => !!this.keyPrefix() && !KEY_PREFIX_PATTERN.test(this.keyPrefix()),
  );
  protected readonly backfilling = signal(false);
  /** Bound as the input's pattern validator so mat-error shows (once touched). */
  protected readonly prefixPattern = KEY_PREFIX_PATTERN;

  protected readonly canReset = computed(
    () => !!this.data.type?.hasDefaults && (this.data.overridden?.length ?? 0) > 0,
  );
  protected readonly canSaveAsDefault = computed(() => !!this.data.type?.canEdit);

  protected isOverridden(...groups: BoardGroup[]): boolean {
    return groups.some((g) => this.data.overridden?.includes(g));
  }

  protected readonly palette = COLOR_PALETTE;

  protected readonly columns = signal<string[]>([...(this.data.config?.columns ?? [])]);
  protected readonly colors = signal<Record<string, string>>({ ...(this.data.config?.colors ?? {}) });
  protected readonly defaultView = signal<'content' | 'board'>(this.data.config?.defaultView ?? 'content');
  protected readonly cardMode = signal<'children' | 'leaves' | 'types'>(
    this.data.config?.leafTypes ? 'leaves'
      : configuredTypeGuids(this.data.config).length ? 'types'
      : 'children',
  );
  protected readonly targetTypeGuids = signal<string[]>(configuredTypeGuids(this.data.config));
  /** "✅ Task · 🐞 Bug" — what leaf mode would collect right now. */
  protected readonly leafSummary = computed(() =>
    leafTypes(this.data.pageTypes).map((t) => `${t.icon} ${t.name}`).join(' · '),
  );
  /** Depth + parent-title options apply to any typed (deep) board. */
  protected readonly typedBoard = computed(() => this.cardMode() !== 'children');
  protected readonly depth = signal<number>(this.data.config?.depth ?? 10);
  protected readonly showParentTitle = signal<boolean>(this.data.config?.showParentTitle ?? true);
  protected readonly swapTitles = signal<boolean>(this.data.config?.swapTitles ?? false);
  protected readonly newColumn = signal<string>('');
  protected readonly editingColor = signal<string | null>(null);

  protected readonly canAddColumn = computed(() => {
    const name = this.newColumn().trim();
    return name.length > 0 && !this.columns().includes(name);
  });

  /**
   * The target-type options offered by "Collect pages of type" — page types
   * with a `state` property to group cards by (step 5.5). Filters
   * {@link BoardSettingsPanelData.pageTypes}, not the full page-types list.
   */
  protected readonly boardableTypeOptions = computed<PageTypeDefinition[]>(() =>
    boardableTypes(this.data.pageTypes),
  );

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

  async onBackfill(): Promise<void> {
    const keys = this.data.ticketKeys;
    if (!keys) return;
    this.backfilling.set(true);
    try {
      const r = await this.ticketKeys.backfill(keys.pageGuid);
      this.snack.open(`Assigned ${r.assigned}, repaired ${r.repaired}`, 'Dismiss', { duration: 4000 });
    } catch {
      this.snack.open('Failed to assign ticket keys.', 'Dismiss', { duration: 4000 });
    } finally {
      this.backfilling.set(false);
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSave(): void { this.dialogRef.close({ action: 'save', config: this.buildConfig() }); }
  onReset(): void { this.dialogRef.close({ action: 'reset', config: this.buildConfig() }); }
  onSaveAsDefault(): void { this.dialogRef.close({ action: 'saveAsDefault', config: this.buildConfig() }); }

  private buildConfig(): BoardConfig {
    const next: BoardConfig = {};
    if (this.columns().length > 0) next.columns = [...this.columns()];
    if (Object.keys(this.colors()).length > 0) next.colors = { ...this.colors() };
    const mode = this.cardMode();
    const options = this.boardableTypeOptions();
    // With no page types loaded (not yet fetched, errored, or none boardable) the option
    // list can't validate anything — keep the configured selection rather than wiping it.
    // Backend schema allows 1-50 guids; otherwise order follows the option list.
    const types = options.length === 0
      ? this.targetTypeGuids().slice(0, 50)
      : options.map((t) => t.guid).filter((g) => this.targetTypeGuids().includes(g)).slice(0, 50);
    const typed = mode === 'leaves' || (mode === 'types' && types.length > 0);
    if (mode === 'leaves') next.leafTypes = true;
    else if (typed) next.targetTypeGuids = types;
    if (typed) {
      next.depth = this.depth();
      next.showParentTitle = this.showParentTitle();
      if (this.swapTitles()) next.swapTitles = true;
    } else if (this.data.type?.hasDefaults) {
      // Direct-children mode hides these controls. For a page whose type has defaults,
      // carry the incoming values through so the caller's override diff doesn't see them
      // as changed; otherwise store exactly what was stored before (fields stripped).
      const inc = this.data.config;
      if (inc?.depth !== undefined) next.depth = inc.depth;
      if (inc?.showParentTitle !== undefined) next.showParentTitle = inc.showParentTitle;
      if (inc?.swapTitles !== undefined) next.swapTitles = inc.swapTitles;
    }
    if (this.defaultView() === 'board') next.defaultView = 'board';
    if (this.data.ticketKeys && this.keyPrefix()) next.keyPrefix = this.keyPrefix();
    return next;
  }
}
