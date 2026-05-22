import { CdkDrag, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Pages, SKIP_CHILDREN_FETCH } from './pages';
import { checkTypeConstraints } from './check-type-constraints';
import type { PageSummary, PageTypeDefinition } from './page.types';

@Component({
  selector: 'wiki-page-tree-item',
  standalone: true,
  imports: [CdkDrag, CdkDropList],
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
            class="delete-button"
            (click)="onDelete($event)"
            aria-label="Delete page"
            title="Delete page"
          >🗑</button>
        </div>
      </div>

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
    .delete-button { background: none; border: 0; cursor: pointer; opacity: 0; padding: 0.125rem; }
    .page-tree-row:hover .delete-button { opacity: 0.7; }
    .delete-button:hover { opacity: 1; color: #dc2626; }
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
  readonly renameRequested = output<string>();
  readonly deleteRequested = output<string>();

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
    this.renameRequested.emit(this.page().guid);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteRequested.emit(this.page().guid);
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
