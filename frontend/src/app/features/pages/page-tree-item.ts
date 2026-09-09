import { CdkDrag, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Pages, SKIP_CHILDREN_FETCH } from './pages';
import { checkTypeConstraints } from './check-type-constraints';
import { PageContextMenu, type ContextMenuEvent } from './page-context-menu';
import type { PageSummary, PageTypeDefinition } from './page.types';

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
        (cdkDropListDropped)="onDrop($event)"
      >
        <div
          class="page-tree-row"
          [class.active]="isActive()"
          [style.padding-left.px]="indent()"
          cdkDrag
          [cdkDragData]="page()"
          role="treeitem"
          tabindex="0"
          [attr.aria-selected]="isActive()"
          (click)="onClick()"
          (dblclick)="onDoubleClick()"
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
  readonly pageTypesMap = input<Record<string, PageTypeDefinition>>({});
  readonly parentPageType = input<string | null>(null);

  readonly pageSelect = output<string>();
  readonly renameRequested = output<{ guid: string; title: string }>();
  readonly deleteRequested = output<string>();
  readonly newChildRequested = output<string>();
  readonly sortRequested = output<{ guid: string; direction: 'asc' | 'desc' }>();
  readonly moveRequested = output<string>();

  private readonly contextMenu = viewChild.required(PageContextMenu);

  private readonly _expanded = signal(false);
  readonly expanded = this._expanded.asReadonly();

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
      case 'delete': this.deleteRequested.emit(event.guid); break;
    }
  }

  onRowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onClick();
    } else if (event.key === 'F2') {
      event.preventDefault();
      this.onDoubleClick();
    }
  }

  async onDrop(event: CdkDragDrop<PageSummary>): Promise<void> {
    const dragged = event.item.data as PageSummary | undefined;
    const target = event.container.data as PageSummary | undefined;
    if (!dragged || !target) return;
    if (dragged.guid === target.guid) return;

    // Reparent: dragged becomes a child of target.
    await this.pages.movePage(dragged.guid, { newParentGuid: target.guid });
    // Auto-expand the target so the new child is visible.
    this._expanded.set(true);
  }
}
