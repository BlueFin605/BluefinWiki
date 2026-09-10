import { CdkDrag, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { Pages, SKIP_CHILDREN_FETCH } from './pages';
import { checkTypeConstraints } from './check-type-constraints';
import { PageContextMenu, type ContextMenuEvent } from './page-context-menu';
import type { PageSummary, PageTypeDefinition, TreeDropRequest, TreeDropZone, TreeExpandTarget } from './page.types';

@Component({
  selector: 'wiki-page-tree-item',
  standalone: true,
  imports: [CdkDrag, CdkDropList, PageContextMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-tree-node">
      <div
        cdkDropList
        [cdkDropListData]="page()"
        [cdkDropListEnterPredicate]="enterPredicate"
        (cdkDropListEntered)="onListEntered()"
        (cdkDropListExited)="clearDropZone()"
        (cdkDropListDropped)="onDrop($event)"
      >
        <div
          class="page-tree-row"
          [class.active]="isActive()"
          [class.drop-before]="dropZone() === 'before'"
          [class.drop-after]="dropZone() === 'after'"
          [class.drop-onto]="dropZone() === 'onto'"
          [style.padding-left.px]="indent()"
          cdkDrag
          [cdkDragData]="page()"
          role="treeitem"
          tabindex="0"
          [attr.aria-selected]="isActive()"
          [attr.aria-expanded]="page().hasChildren ? expanded() : null"
          (click)="onClick()"
          (dblclick)="onDoubleClick()"
          (mousemove)="onRowDragOver($event)"
          (keydown)="onRowKeydown($event)"
          (contextmenu)="onContextMenu($event)"
        >
          @if (page().hasChildren) {
            <button
              type="button"
              class="chevron"
              [class.expanded]="expanded()"
              (click)="toggleExpanded($event)"
              [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
            >▶</button>
          } @else {
            <span class="chevron-spacer"></span>
          }

          @if (icon(); as iconText) {
            <span class="page-icon" [attr.title]="iconTitle()">{{ iconText }}</span>
          } @else {
            <span class="page-icon">📄</span>
          }

          <span class="page-title">{{ page().title }}</span>

          <button
            type="button"
            class="add-child-button"
            (click)="onNewChild($event)"
            aria-label="Add child page"
            title="Create child page"
          >+</button>
        </div>
      </div>

      <wiki-page-context-menu
        [guid]="page().guid"
        [hasChildren]="page().hasChildren"
        (menuEvent)="onMenuEvent($event)"
      />

      @if (expanded() && children.value(); as kids) {
        @for (child of kids; track child.guid) {
          <wiki-page-tree-item
            [page]="child"
            [level]="level() + 1"
            [activeGuid]="activeGuid()"
            [expandGuid]="expandGuid()"
            [pageTypesMap]="pageTypesMap()"
            [parentPageType]="page().pageType ?? null"
            (pageSelect)="pageSelect.emit($event)"
            (renameRequested)="renameRequested.emit($event)"
            (deleteRequested)="deleteRequested.emit($event)"
            (newChildRequested)="newChildRequested.emit($event)"
            (sortRequested)="sortRequested.emit($event)"
            (moveRequested)="moveRequested.emit($event)"
          />
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .page-tree-row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      user-select: none;
      border-radius: 4px;
    }
    .page-tree-row:hover { background: #f1f5f9; }
    .page-tree-row.active { background: #dbeafe; font-weight: 600; }
    /* Step 2.1 positional-drop indicators: a line above/below for before/after,
       a row highlight for onto (matches .cdk-drop-list-receiving). */
    .page-tree-row.drop-onto { background: #fef3c7; outline: 1px solid #f59e0b; outline-offset: -1px; }
    .page-tree-row.drop-before::before,
    .page-tree-row.drop-after::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: #2563eb;
      pointer-events: none;
    }
    .page-tree-row.drop-before::before { top: -1px; }
    .page-tree-row.drop-after::after { bottom: -1px; }
    .chevron { background: none; border: 0; cursor: pointer; font-size: 0.625rem; width: 16px; transition: transform 0.1s; }
    .chevron.expanded { transform: rotate(90deg); }
    .chevron-spacer { display: inline-block; width: 16px; }
    .page-icon { width: 18px; text-align: center; }
    .page-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .add-child-button { background: none; border: 0; cursor: pointer; opacity: 0; padding: 0.125rem; font-size: 1rem; line-height: 1; color: #6b7280; }
    .page-tree-row:hover .add-child-button { opacity: 0.7; }
    .add-child-button:hover { opacity: 1; color: #2563eb; }
    .cdk-drop-list-receiving .page-tree-row { background: #fef3c7; }
  `],
})
export class PageTreeItem {
  private readonly pages = inject(Pages);

  readonly page = input.required<PageSummary>();
  readonly level = input.required<number>();
  readonly activeGuid = input<string | null>(null);
  /**
   * Force-expand target (step 2.3). When `expandGuid()?.guid` matches this
   * row's guid the node expands — loading its children if not already loaded —
   * so a page created under it is visible in context. The payload's `nonce`
   * means a repeat expand of the same guid is still a distinct object, so the
   * effect below re-fires even if the user collapsed the node in between.
   * Threaded down the recursive tree; step 2.6 (New Page modal) feeds it too.
   */
  readonly expandGuid = input<TreeExpandTarget | null>(null);
  readonly pageTypesMap = input<Record<string, PageTypeDefinition>>({});
  readonly parentPageType = input<string | null>(null);

  readonly pageSelect = output<string>();
  readonly renameRequested = output<{ guid: string; title: string }>();
  readonly deleteRequested = output<{ guid: string; hasChildren: boolean }>();
  readonly newChildRequested = output<string>();
  readonly sortRequested = output<{ guid: string; direction: 'asc' | 'desc' }>();
  readonly moveRequested = output<string>();
  /**
   * Step 2.1: a positional (`before` / `after`) drop. `pages-view` owns the
   * splice + the cross-parent two-step; an `onto` drop is handled locally in
   * `onDrop` (unchanged `movePage`) and never emits this.
   */
  readonly dropRequested = output<TreeDropRequest>();

  private readonly contextMenu = viewChild.required(PageContextMenu);

  private readonly _expanded = signal(false);
  readonly expanded = this._expanded.asReadonly();

  /**
   * Step 2.1: the drop zone the pointer is currently in for THIS row, or `null`
   * when no drag is hovering it. Drives the before/after line + onto highlight
   * and is read back in `onDrop`. Set by `onRowDragOver`, cleared on
   * `cdkDropListExited` / after a drop.
   */
  private readonly _dropZone = signal<TreeDropZone | null>(null);
  readonly dropZone = this._dropZone.asReadonly();

  /**
   * True only while a CDK drag is hovering this row's drop list (between
   * `cdkDropListEntered` and `cdkDropListExited`). `onRowDragOver` fires on every
   * `mousemove`, so it no-ops unless this is set — the zone maths never runs
   * outside a drag.
   */
  private readonly _dragActive = signal(false);

  private readonly childrenGuid = computed<string | null | typeof SKIP_CHILDREN_FETCH>(() =>
    this._expanded() ? this.page().guid : SKIP_CHILDREN_FETCH,
  );
  // Children resource — lazy-fetched only when expanded.
  readonly children = this.pages.childrenResource(this.childrenGuid);

  readonly indent = computed(() => this.level() * 16 + 8);
  readonly isActive = computed(() => this.activeGuid() === this.page().guid);

  readonly icon = computed<string | null>(() => {
    const type = this.page().pageType;
    if (!type) return null;
    return this.pageTypesMap()[type]?.icon ?? null;
  });

  readonly iconTitle = computed<string | null>(() => {
    const type = this.page().pageType;
    if (!type) return null;
    return this.pageTypesMap()[type]?.name ?? null;
  });

  readonly enterPredicate = (drag: CdkDrag<PageSummary>): boolean => {
    const dragged = drag.data;
    if (!dragged) return true;
    if (dragged.guid === this.page().guid) return false;
    const warnings = checkTypeConstraints(dragged, this.page(), this.pageTypesMap());
    return warnings.length === 0;
  };

  constructor() {
    // Force-expand (step 2.3): when the tree points expandGuid at this row,
    // expand it. Flipping `_expanded` re-keys `childrenGuid`, so the lazy
    // `childrenResource` fetches the children if they were never loaded. Each
    // create carries a fresh `nonce`, so this re-runs (and re-expands) even for
    // a repeat create under the same, since-collapsed parent.
    effect(() => {
      const target = this.expandGuid();
      if (target && target.guid === this.page().guid) {
        this._expanded.set(true);
      }
    });
  }

  toggleExpanded(event: MouseEvent): void {
    event.stopPropagation();
    this._expanded.update((v) => !v);
  }

  onClick(): void {
    this.pageSelect.emit(this.page().guid);
  }

  onDoubleClick(): void {
    this.renameRequested.emit({ guid: this.page().guid, title: this.page().title });
  }

  onNewChild(event: MouseEvent): void {
    event.stopPropagation();
    this.newChildRequested.emit(this.page().guid);
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenu().open({ x: event.clientX, y: event.clientY });
  }

  onMenuEvent(event: ContextMenuEvent): void {
    switch (event.kind) {
      case 'rename': this.renameRequested.emit({ guid: event.guid, title: this.page().title }); break;
      case 'newChild': this.newChildRequested.emit(event.guid); break;
      case 'sort': this.sortRequested.emit({ guid: event.guid, direction: event.direction }); break;
      case 'move': this.moveRequested.emit(event.guid); break;
      case 'delete': this.deleteRequested.emit({ guid: event.guid, hasChildren: this.page().hasChildren }); break;
    }
  }

  onRowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onClick();
    } else if (event.key === 'F2') {
      event.preventDefault();
      this.onDoubleClick();
    } else if (event.key === 'ArrowRight') {
      // Collapsed parent -> expand. Expanded parent -> step into first child.
      // Leaf -> no-op (let the event through).
      if (!this.page().hasChildren) return;
      event.preventDefault();
      if (this.expanded()) this.focusFirstChildRow(event.currentTarget);
      else this._expanded.set(true);
    } else if (event.key === 'ArrowLeft') {
      // Expanded parent -> collapse. Collapsed row / leaf -> step out to parent.
      event.preventDefault();
      if (this.page().hasChildren && this.expanded()) this._expanded.set(false);
      else this.focusParentRow(event.currentTarget);
    }
  }

  /** Move focus to the first rendered child row (ArrowRight on an open parent). */
  private focusFirstChildRow(from: EventTarget | null): void {
    (from as HTMLElement | null)
      ?.closest('.page-tree-node')
      ?.querySelector<HTMLElement>(':scope > wiki-page-tree-item .page-tree-row')
      ?.focus();
  }

  /**
   * Move focus to the parent row (ArrowLeft on a collapsed row / leaf). A root
   * row's node has no ancestor `.page-tree-node`, so this is a no-op there.
   */
  private focusParentRow(from: EventTarget | null): void {
    (from as HTMLElement | null)
      ?.closest('.page-tree-node')
      ?.parentElement
      ?.closest('.page-tree-node')
      ?.querySelector<HTMLElement>('.page-tree-row')
      ?.focus();
  }

  /**
   * Step 2.1: classify a pointer Y within a row rect into before / after / onto.
   * Top 25 % -> `before`, bottom 25 % -> `after`, middle 50 % -> `onto`. Pure —
   * no component state, exposed for unit tests.
   */
  zoneFromClientY(clientY: number, rect: { top: number; height: number }): TreeDropZone {
    if (rect.height <= 0) return 'onto';
    const ratio = (clientY - rect.top) / rect.height;
    if (ratio < 0.25) return 'before';
    if (ratio >= 0.75) return 'after';
    return 'onto';
  }

  /** A CDK drag entered this row's drop list — arm the zone maths. */
  onListEntered(): void {
    this._dragActive.set(true);
  }

  /** Clear the zone indicator (drag left the row, or the drop finished). */
  clearDropZone(): void {
    this._dragActive.set(false);
    this._dropZone.set(null);
  }

  /**
   * `mousemove` on the row. The CDK drag preview is `pointer-events: none`, so
   * this still fires while dragging. No-ops unless a drag is over the row
   * (`_dragActive`); otherwise it stores the pointer's zone for the indicator +
   * `onDrop`.
   */
  onRowDragOver(event: MouseEvent): void {
    if (!this._dragActive()) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this._dropZone.set(this.zoneFromClientY(event.clientY, rect));
  }

  async onDrop(event: CdkDragDrop<PageSummary>): Promise<void> {
    const dragged = event.item.data as PageSummary | undefined;
    const target = event.container.data as PageSummary | undefined;
    const zone = this._dropZone() ?? 'onto';
    this.clearDropZone();
    if (!dragged || !target) return;
    if (dragged.guid === target.guid) return;

    if (zone === 'onto') {
      // Reparent: dragged becomes a child of target (unchanged pre-2.1 path).
      await this.pages.movePage(dragged.guid, { newParentGuid: target.guid });
      // Auto-expand the target so the new child is visible.
      this._expanded.set(true);
      return;
    }

    // before / after: positional reorder. pages-view owns the sibling splice and
    // the cross-parent move-then-reorder (it needs the target parent's list).
    this.dropRequested.emit({
      movingGuid: dragged.guid,
      movingParentGuid: dragged.parentGuid,
      targetGuid: target.guid,
      targetParentGuid: target.parentGuid,
      zone,
    });
  }
}
