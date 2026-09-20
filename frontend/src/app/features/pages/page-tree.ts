import { CdkDropList, CdkDropListGroup, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Pages } from './pages';
import { checkSiblingDropAllowed } from './check-type-constraints';
import { PageTreeItem } from './page-tree-item';
import type { PageSummary, PageTypeDefinition, TreeDropRequest, TreeExpandTarget } from './page.types';

@Component({
  selector: 'wiki-page-tree',
  standalone: true,
  imports: [CdkDropList, CdkDropListGroup, PageTreeItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div cdkDropListGroup class="page-tree" role="tree" aria-label="Page tree">
      @if (showInitialLoading()) {
        <div class="state">Loading pages...</div>
      } @else if (rootChildren.error() && !displayedRoot()) {
        <div class="state error">Failed to load pages.</div>
      } @else if ((displayedRoot() ?? []).length === 0) {
        <div class="state empty">No pages yet.</div>
      } @else {
        @for (page of displayedRoot() ?? []; track page.guid) {
          <wiki-page-tree-item
            [page]="page"
            [level]="0"
            [activeGuid]="activeGuid()"
            [expandGuid]="expandGuid()"
            [pageTypesMap]="pageTypesMap()"
            [parentPageType]="null"
            (pageSelect)="pageSelect.emit($event)"
            (renameRequested)="renameRequested.emit($event)"
            (deleteRequested)="deleteRequested.emit($event)"
            (newChildRequested)="newChildRequested.emit($event)"
            (sortRequested)="sortRequested.emit($event)"
            (moveRequested)="moveRequested.emit($event)"
            (dropRequested)="dropRequested.emit($event)"
          />
        }
      }

      <div
        class="root-drop-zone"
        cdkDropList
        [cdkDropListData]="null"
        (cdkDropListDropped)="onRootDrop($event)"
      >Drop here to make a root page</div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .page-tree { display: flex; flex-direction: column; height: 100%; overflow-y: auto; }
    .state { padding: 1rem; color: #6b7280; font-size: 0.875rem; }
    .state.error { color: #b91c1c; }
    .root-drop-zone {
      margin-top: auto;
      padding: 0.75rem;
      border: 1px dashed transparent;
      color: #9ca3af;
      font-size: 0.75rem;
      text-align: center;
    }
    .root-drop-zone.cdk-drop-list-receiving {
      border-color: #f59e0b;
      background: #fef3c7;
      color: #92400e;
    }
  `],
})
export class PageTree {
  private readonly pages = inject(Pages);
  private readonly rootSignal = signal<string | null>(null);

  readonly activeGuid = input<string | null>(null);
  /**
   * Force-expand target (step 2.3). `pages-view` sets this after `createPage`
   * succeeds from any entry point; the tree node with `expandGuid()?.guid`
   * expands and loads its children so the new page shows in context. The
   * `nonce` makes every create a distinct value (repeat creates under one
   * parent still fire). `null` is inert. Reused by step 2.6 (New Page modal).
   */
  readonly expandGuid = input<TreeExpandTarget | null>(null);
  readonly pageTypesMap = input<Record<string, PageTypeDefinition>>({});

  readonly pageSelect = output<string>();
  readonly renameRequested = output<{ guid: string; title: string }>();
  readonly deleteRequested = output<{ guid: string; hasChildren: boolean }>();
  readonly newChildRequested = output<string>();
  readonly sortRequested = output<{ guid: string; direction: 'asc' | 'desc' }>();
  readonly moveRequested = output<string>();
  /** Step 2.1: positional (before/after) drop, forwarded to `pages-view`. */
  readonly dropRequested = output<TreeDropRequest>();

  readonly rootChildren = this.pages.childrenResource(this.rootSignal);

  /**
   * `rootChildren`, RETAINED across an invalidation-driven reload.
   * `rootChildren` keys on the coarse `children:any` tag (invalidation.ts) —
   * ANY tree-visible edit ANYWHERE (a rename, a status/type change, a
   * reorder…) bumps it, and Angular's `resource()` clears `value()`/
   * `status()` back to `'loading'` with no retained-value API. Reading
   * `rootChildren.value()` directly in the template therefore replaced the
   * WHOLE tree with the "Loading pages..." placeholder on every such edit,
   * destroying every `wiki-page-tree-item` at every depth and resetting each
   * row's own local `expanded` signal — collapsing the entire tree for
   * anyone who had it open, for an edit anywhere in the wiki. Same fix as
   * `page-tree-item.ts`'s `displayedChildren` and `page-detail.ts`'s
   * `eligibilityChildren` ("keep painting the last-good data through a
   * reload", also `BoardView.showInitialLoading`'s rule).
   *
   * `value()` throws on an errored resource — only read it once resolved.
   */
  protected readonly displayedRoot = linkedSignal<PageSummary[] | undefined, PageSummary[] | undefined>({
    source: () => (this.rootChildren.status() === 'resolved' ? this.rootChildren.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });

  /** Only a genuine first load (nothing ever retained yet) shows the placeholder. */
  protected readonly showInitialLoading = computed(
    () => this.rootChildren.isLoading() && this.displayedRoot() === undefined,
  );

  /**
   * Reparent a dragged page to the tree root. The zone has no
   * `cdkDropListEnterPredicate` (there is no row to compute a zone against), so
   * the type check happens here, on drop: the root is a "no parent" target, which
   * `checkSiblingDropAllowed` models with a `null` parent page type. A page whose
   * type demands a specific parent (`allowAnyParent: false`) is refused with the
   * same alert-and-abort the `onto` and cross-parent drop paths use.
   */
  async onRootDrop(event: CdkDragDrop<null>): Promise<void> {
    const dragged = event.item.data as PageSummary | undefined;
    if (!dragged) return;
    if (dragged.parentGuid === null) return; // already a root page
    const warnings = checkSiblingDropAllowed(dragged, null, this.pageTypesMap());
    if (warnings.length > 0) {
      window.alert('Cannot move here:\n' + warnings.join('\n'));
      return;
    }
    await this.pages.movePage(dragged.guid, { newParentGuid: null });
  }
}
