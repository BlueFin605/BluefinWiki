import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Pages, type ChildrenWithPropertiesOptions } from '../pages/pages';
import { PageTypes } from '../page-types/page-types';
import { BoardColumn } from './board-column';
import { CardSummaryDialog, type CardSummaryDialogData } from './card-summary-dialog';
import { getColumnColor, groupByState } from './group-by-state';
import type {
  BoardConfig,
  PageChildDetail,
  PageProperty,
  PageTypeDefinition,
} from '../pages/page.types';

/**
 * Kanban Board view. Loads the children of `parentGuid` with their
 * properties, groups them by `state`, and renders one column per state.
 * Dropping a card across columns persists the new state via `updatePage`.
 */
@Component({
  selector: 'wiki-board-view',
  standalone: true,
  imports: [CdkDropListGroup, BoardColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (childrenResource.isLoading()) {
      <div class="state">Loading board...</div>
    } @else if (childrenResource.error()) {
      <div class="state error">Failed to load board.</div>
    } @else {
      <div class="board-body">
        <div cdkDropListGroup class="board-cols">
          @for (col of grouping().columns; track col) {
            <wiki-board-column
              [name]="col"
              [color]="columnColor(col)"
              [cards]="grouping().cardsByColumn[col] ?? []"
              [pageTypesMap]="pageTypesMap()"
              [swapTitles]="boardConfig()?.swapTitles ?? false"
              [showParentTitle]="boardConfig()?.showParentTitle ?? true"
              (cardDropped)="onCardDropped($event)"
              (cardClick)="onCardClick($event)"
            />
          } @empty {
            <div class="state">No items to display on the board.</div>
          }
        </div>
        @if (hasMoreCards()) {
          <div class="load-more">
            <button
              type="button"
              class="load-more-btn"
              [disabled]="loadingMore()"
              (click)="onLoadMore()"
            >
              {{ loadingMore() ? 'Loading…' : 'Load more cards' }}
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .board-body {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .board-cols {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      overflow-x: auto;
      overflow-y: hidden;
      flex: 1;
    }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
    .load-more {
      display: flex;
      justify-content: center;
      padding: 0 1rem 1rem;
    }
    .load-more-btn {
      padding: 0.5rem 1.25rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background: #fff;
      cursor: pointer;
    }
    .load-more-btn:disabled {
      cursor: default;
      opacity: 0.7;
    }
  `],
})
export class BoardView {
  private readonly pages = inject(Pages);
  private readonly pageTypes = inject(PageTypes);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly parentGuid = input.required<string>();
  readonly boardConfig = input<BoardConfig | null>(null);

  private readonly parentGuidSig = computed<string | null>(() => this.parentGuid() ?? null);
  private readonly options = computed<ChildrenWithPropertiesOptions | null>(() => {
    const cfg = this.boardConfig();
    if (cfg?.targetTypeGuid) {
      return { targetTypeGuid: cfg.targetTypeGuid, depth: cfg.depth ?? 10, limit: 200 };
    }
    return { limit: 200 };
  });

  readonly childrenResource = this.pages.childrenWithPropertiesResource(this.parentGuidSig, this.options);
  readonly pageTypesResource = this.pageTypes.pageTypesResource();

  // The resource above always fetches page one (it re-fetches on parentGuid /
  // options change and on invalidation-bus bumps). "Load more cards" pages
  // beyond that imperatively via `pages.fetchChildrenWithProperties` and
  // appends into this accumulator, which is what `grouping` reads from.
  private readonly accumulated = signal<PageChildDetail[]>([]);
  private readonly nextCursor = signal<string | null>(null);
  protected readonly hasMoreCards = signal(false);
  protected readonly loadingMore = signal(false);

  // Bumped every time the reset effect below runs (i.e. every time
  // `childrenResource` resolves a fresh page one). `onLoadMore()` captures
  // the current value before it starts its fetch and only applies the
  // response if the generation is unchanged when it comes back — this closes
  // the race where a reset (parent/config change, or an invalidation-bus
  // bump such as `children:any`) lands while a "Load more" request is still
  // in flight: without the guard, the in-flight response would overwrite the
  // just-reset `nextCursor`/`hasMoreCards` with values computed against the
  // stale pre-reset basis.
  private readonly generation = signal(0);

  constructor() {
    // Reset the accumulator every time the resource resolves a fresh page
    // one — a parentGuid/targetTypeGuid/depth change or an invalidation bump
    // (e.g. step 1.2's `children:<parent>`) always re-fetches page one, so
    // resetting here covers both without a separate watcher.
    effect(() => {
      if (this.childrenResource.status() !== 'resolved') return;
      const value = this.childrenResource.value();
      this.generation.update((g) => g + 1);
      this.applyPage(value ?? null, 'reset');
    });
  }

  /**
   * Shared apply logic for both the reset effect and `onLoadMore()`: writes
   * `nextCursor`/`hasMoreCards` from a page response, either replacing
   * `accumulated` ('reset', fresh page one) or appending to it ('append', a
   * "Load more" page).
   */
  private applyPage(
    value: { children?: PageChildDetail[]; nextCursor?: string | null; hasMore?: boolean } | null,
    mode: 'reset' | 'append',
  ): void {
    const children = value?.children ?? [];
    if (mode === 'reset') {
      this.accumulated.set(children);
    } else {
      this.accumulated.update((current) => [...current, ...children]);
    }
    this.nextCursor.set(value?.nextCursor ?? null);
    this.hasMoreCards.set(value?.hasMore === true);
  }

  protected readonly pageTypesMap = computed<Record<string, PageTypeDefinition>>(() => {
    if (this.pageTypesResource.status() !== 'resolved') return {};
    const list = this.pageTypesResource.value() ?? [];
    return Object.fromEntries(list.map((t) => [t.guid, t]));
  });

  protected readonly grouping = computed(() => {
    return groupByState(this.accumulated(), this.boardConfig() ?? undefined);
  });

  protected columnColor(name: string): string {
    return getColumnColor(name, this.boardConfig()?.colors);
  }

  async onCardDropped(event: { card: PageChildDetail; targetState: string }): Promise<void> {
    const { card, targetState } = event;
    const currentStateValue = card.properties?.['state']?.value;
    const currentState = typeof currentStateValue === 'string' && currentStateValue
      ? currentStateValue
      : 'Uncategorised';
    if (currentState === targetState) return;
    const merged: Record<string, PageProperty> = {
      ...(card.properties ?? {}),
      state: { type: 'string', value: targetState },
    };
    try {
      await this.pages.updatePage(card.guid, { properties: merged });
    } catch {
      this.snack.open(`Failed to move "${card.title}".`, 'Dismiss', { duration: 4000 });
    }
  }

  onCardClick(card: PageChildDetail): void {
    const pageType = card.pageType ? this.pageTypesMap()[card.pageType] ?? null : null;
    const data: CardSummaryDialogData = { card, pageType };
    this.dialog.open(CardSummaryDialog, { data });
  }

  async onLoadMore(): Promise<void> {
    const cursor = this.nextCursor();
    const parentGuid = this.parentGuidSig();
    if (!cursor || !parentGuid || this.loadingMore()) return;
    // Capture the generation before the request goes out. If a reset (parent/
    // config change, or an invalidation-bus bump) runs while this request is
    // in flight, the generation will have moved on by the time the response
    // arrives — discard it silently rather than appending stale-cursor data
    // onto the freshly-reset accumulator.
    const token = this.generation();
    this.loadingMore.set(true);
    try {
      const response = await this.pages.fetchChildrenWithProperties(parentGuid, {
        ...(this.options() ?? {}),
        cursor,
      });
      if (this.generation() !== token) return;
      this.applyPage(response, 'append');
    } finally {
      this.loadingMore.set(false);
    }
  }
}
