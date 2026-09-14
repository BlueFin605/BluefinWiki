import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Pages, type ChildrenWithPropertiesOptions } from '../pages/pages';
import { PageTypes } from '../page-types/page-types';
import { BoardColumn } from './board-column';
import { CardSummaryDialog, type CardSummaryDialogData } from './card-summary-dialog';
import { computeBoardOrder } from './compute-board-order';
import { getColumnColor, groupByState } from './group-by-state';
import type {
  BoardConfig,
  PageChildDetail,
  PageProperty,
  PageTypeDefinition,
  UpdatePageRequest,
} from '../pages/page.types';

/** The slice of a children-with-properties response the board accumulator needs. */
interface BoardPageResponse {
  children?: PageChildDetail[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

/** Base page size the board asks for. */
const PAGE_SIZE = 200;
/** Backend page-size ceiling (`backend/src/pages/pages-list-children.ts`). */
const MAX_LIMIT = 500;

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
    @if (showInitialLoading()) {
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
              [disabled]="paging()"
              (click)="onLoadMore()"
            >
              {{ paging() ? 'Loading…' : 'Load more cards' }}
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
      return { targetTypeGuid: cfg.targetTypeGuid, depth: cfg.depth ?? 10, limit: PAGE_SIZE };
    }
    return { limit: PAGE_SIZE };
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
  /** True while {@link restoreWindow} is re-fetching a multi-page window. */
  private readonly restoringWindow = signal(false);
  /** Either kind of paging work — drives the "Load more" button's busy state. */
  protected readonly paging = computed(() => this.loadingMore() || this.restoringWindow());

  /**
   * How many `PAGE_SIZE`-sized pages `accumulated` currently represents: 1
   * after a fresh page one, +1 per successful "Load more". Used to restore
   * the same window after an invalidation-triggered reset (see
   * {@link restoreWindow}) instead of collapsing the user back to page one.
   */
  private readonly loadedPages = signal(1);

  /**
   * Identity of the basis `accumulated` was built against — parent guid plus
   * the query-shaping options. A reset whose basis key is UNCHANGED is an
   * invalidation-bus refresh of the same board (a drop, a Card Summary save)
   * and must preserve the loaded window; a reset whose key CHANGED is a
   * genuine parent/config switch, where collapsing to page one is correct.
   */
  private lastBasisKey: string | null = null;

  /**
   * Show the "Loading board…" placeholder only on a genuine first load. Every
   * successful drop and Card Summary save bumps `children:any`, which puts
   * `childrenResource` back into a loading state — blanking the whole board
   * there would unmount every column and erase the optimistic patch that
   * steps 5.3/5.4 exist to produce. With something already accumulated we
   * keep painting the last-good grouping until the reload lands.
   */
  protected readonly showInitialLoading = computed(
    () => this.childrenResource.isLoading() && this.accumulated().length === 0,
  );

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
    // handling both here covers them without a separate watcher. The body
    // runs `untracked` so that the bookkeeping signals it reads (and writes)
    // never become dependencies of this effect — the resource's
    // status/value are the only intended triggers.
    effect(() => {
      if (this.childrenResource.status() !== 'resolved') return;
      const value = this.childrenResource.value() ?? null;
      untracked(() => this.onPageOneResolved(value));
    });
  }

  /** Parent + query options that `accumulated` is currently built against. */
  private basisKey(): string {
    const opts = this.options() ?? {};
    return JSON.stringify([
      this.parentGuidSig(),
      opts.targetTypeGuid ?? null,
      opts.depth ?? null,
      opts.limit ?? null,
    ]);
  }

  /**
   * Fresh page one landed. Either collapse to it (a genuine parent/config
   * change, or nothing beyond page one was ever loaded) or — when this is
   * just an invalidation refresh of the SAME board and the user had paged
   * further — restore the window they had, so a single drag doesn't silently
   * throw away the 400 extra cards they clicked "Load more" for.
   */
  private onPageOneResolved(value: BoardPageResponse | null): void {
    const key = this.basisKey();
    const basisChanged = key !== this.lastBasisKey;
    this.lastBasisKey = key;

    this.generation.update((g) => g + 1);
    const token = this.generation();

    if (basisChanged || this.loadedPages() <= 1) {
      this.loadedPages.set(1);
      this.applyPage(value, 'reset');
      return;
    }
    void this.restoreWindow(value, token);
  }

  /**
   * Re-page forward from `firstPage` until the previously-loaded window is
   * covered again, then swap it in as one atomic replacement.
   *
   * Deliberately does NOT apply `firstPage` first: doing so would visibly
   * collapse the board to 200 cards and pop the "Load more" button back for
   * the duration of the refetch. The (already optimistically patched) old
   * accumulator stays on screen until the full window is in hand.
   *
   * The window is requested with an inflated `limit` (capped at the
   * backend's own 500 ceiling) so the common two- or three-page window costs
   * exactly one extra request, not one per page.
   */
  private async restoreWindow(firstPage: BoardPageResponse | null, token: number): Promise<void> {
    const parentGuid = this.parentGuidSig();
    if (!parentGuid) {
      this.loadedPages.set(1);
      this.applyPage(firstPage, 'reset');
      return;
    }
    const basePageSize = this.options()?.limit ?? PAGE_SIZE;
    const targetCount = basePageSize * this.loadedPages();

    let children = firstPage?.children ?? [];
    let cursor = firstPage?.nextCursor ?? null;
    let hasMore = firstPage?.hasMore === true;

    this.restoringWindow.set(true);
    try {
      while (hasMore && cursor && children.length < targetCount) {
        const response = await this.pages.fetchChildrenWithProperties(parentGuid, {
          ...(this.options() ?? {}),
          limit: Math.min(targetCount - children.length, MAX_LIMIT),
          cursor,
        });
        // A newer reset has superseded this restore — drop it on the floor,
        // exactly as `onLoadMore` does with a stale page.
        if (this.generation() !== token) return;
        children = [...children, ...(response.children ?? [])];
        cursor = response.nextCursor ?? null;
        hasMore = response.hasMore === true;
      }
    } catch (err) {
      if (this.generation() !== token) return;
      // Couldn't rebuild the window: fall back to the collapsed page one
      // rather than leaving stale pre-mutation cards on screen, and say so.
      this.loadedPages.set(1);
      this.applyPage(firstPage, 'reset');
      this.snack.open(
        `Couldn't reload all cards — ${this.toMessage(err, 'Something went wrong.')}`,
        'Dismiss',
        { duration: 4000 },
      );
      return;
    } finally {
      if (this.generation() === token) this.restoringWindow.set(false);
    }

    // `loadedPages` is deliberately left as-is: it records the window the
    // user asked for, not how many cards came back. A shrinking board (cards
    // deleted elsewhere) just makes the next restore stop early on `hasMore`.
    this.accumulated.set(children);
    this.nextCursor.set(cursor);
    this.hasMoreCards.set(hasMore);
  }

  /**
   * Shared apply logic for both the reset effect and `onLoadMore()`: writes
   * `nextCursor`/`hasMoreCards` from a page response, either replacing
   * `accumulated` ('reset', fresh page one) or appending to it ('append', a
   * "Load more" page).
   */
  private applyPage(
    value: BoardPageResponse | null,
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

  /**
   * Handles a card dropped at `targetIndex` within `targetState`'s column
   * (step 5.4; supersedes step 5.3's column-only handling). Computes the new
   * `boardOrder`(s) via `computeBoardOrder`, applies an optimistic patch to
   * every affected card, PUTs one request per affected card (`state` +
   * `boardOrder` together for the dragged card when it also crosses
   * columns, `boardOrder` alone for everyone else), and rolls back on
   * failure — reusing step 5.3's generation-guard so a concurrent reset
   * never gets clobbered by a stale rollback.
   *
   * No batch/bulk update endpoint exists on the backend (confirmed against
   * `infrastructure/.../UnifiedStack.cs`'s API Gateway routes: the only page
   * mutation routes are `PUT /pages/{guid}` and `PUT /pages/reorder`, the
   * latter dedicated to the *tree's* `sortOrder`, not `boardOrder`) — so the
   * renumber fallback below always issues N independent `PUT /pages/{guid}`
   * calls, same as the single-card path.
   */
  async onCardDropped(event: {
    card: PageChildDetail;
    targetState: string;
    targetIndex: number;
  }): Promise<void> {
    const { card, targetState, targetIndex } = event;
    const currentStateValue = card.properties?.['state']?.value;
    const currentState = typeof currentStateValue === 'string' && currentStateValue
      ? currentStateValue
      : 'Uncategorised';
    const stateChanged = currentState !== targetState;

    // The destination column's current cards (pre-drop), in display order —
    // this is exactly what the user saw `targetIndex` measured against.
    const destCardsAll = this.grouping().cardsByColumn[targetState] ?? [];
    const currentIndexInDest = destCardsAll.findIndex((c) => c.guid === card.guid);
    // True no-op: same column, same slot — nothing moved.
    if (!stateChanged && currentIndexInDest === targetIndex) return;

    // Splice the dragged card into its target slot among the OTHER cards in
    // the destination column (removing it first if this is a same-column
    // reorder, so it isn't double-counted), matching CDK's own
    // remove-then-reinsert semantics for `event.currentIndex`.
    const destOthers = destCardsAll.filter((c) => c.guid !== card.guid);
    const clampedIndex = Math.max(0, Math.min(targetIndex, destOthers.length));
    const columnCards = [
      ...destOthers.slice(0, clampedIndex),
      card,
      ...destOthers.slice(clampedIndex),
    ];
    const result = computeBoardOrder(columnCards, clampedIndex);

    const moverProperties: Record<string, PageProperty> | undefined = stateChanged
      ? { ...(card.properties ?? {}), state: { type: 'string', value: targetState } }
      : undefined;

    const boardOrderByGuid = new Map<string, number>(
      'value' in result
        ? [[card.guid, result.value]]
        : result.renumber.map((r) => [r.guid, r.value] as const),
    );

    // `boardOrderByGuid` now governs ONLY whether a guid's PUT body carries a
    // `boardOrder` field — it is not the full set of guids that need a PUT.
    // The renumber fallback (fix wave 1) omits a card from its result when
    // that card's renumbered value happens to equal its current
    // `boardOrder`, so the mover can legitimately be absent from
    // `boardOrderByGuid` even on a cross-column drop: two columns sharing
    // the same base-1000 sequential convention make it plausible for the
    // mover's freshly renumbered slot in the destination column to
    // coincidentally match the value it already carried from its PREVIOUS
    // column. When that happens the mover's `state` change must still reach
    // the server — dropped entirely was fix wave 2's regression. So the
    // mover is always affected when `stateChanged`, regardless of whether
    // its `boardOrder` component survived the renumber filter.
    const affectedGuids = new Set(boardOrderByGuid.keys());
    if (stateChanged) affectedGuids.add(card.guid);

    // Optimistic move: patch every affected card's local model immediately,
    // before any PUT resolves, per the React reference behaviour. Capture
    // the generation token *before* mutating — see the comment further down
    // for why a failure only rolls back when this token still matches.
    const token = this.generation();
    const priors = new Map<string, PageChildDetail>();
    this.accumulated.update((cards) =>
      cards.map((c) => {
        if (!affectedGuids.has(c.guid)) return c;
        priors.set(c.guid, c);
        const isMover = c.guid === card.guid;
        const boardOrder = boardOrderByGuid.get(c.guid);
        return {
          ...c,
          ...(boardOrder !== undefined ? { boardOrder } : {}),
          ...(isMover && moverProperties ? { properties: moverProperties } : {}),
        };
      }),
    );

    const entries = [...affectedGuids];
    const settled = await Promise.allSettled(
      entries.map((guid) => {
        const isMover = guid === card.guid;
        const boardOrder = boardOrderByGuid.get(guid);
        const body: UpdatePageRequest = {};
        if (boardOrder !== undefined) body.boardOrder = boardOrder;
        if (isMover && moverProperties) body.properties = moverProperties;
        return this.pages.updatePage(guid, body);
      }),
    );
    // Success: each successful `updatePage` bumps `children:any` (see its
    // doc comment), which re-fetches page one and resets `accumulated` via
    // the constructor effect above — that reconciles the affected cards with
    // the server's authoritative state. Nothing further to do for those:
    // the optimistic patch already shows them in place, so there's no
    // visible jump when the reset lands.

    const failures = settled
      .map((r, i) => ({ r, guid: entries[i] }))
      .filter((x): x is { r: PromiseRejectedResult; guid: string } => x.r.status === 'rejected');
    if (failures.length === 0) return;

    // Only roll back cards whose own PUT failed — a card whose PUT
    // succeeded is already correct server-side (and will shortly be
    // reconciled by the reset above); rolling it back too would show a
    // position the server no longer has. And only roll back at all if
    // nothing has reset the accumulator since we started (generation
    // unchanged) — if a reset landed in between (a sibling PUT's own
    // success above, or an unrelated invalidation-bus bump elsewhere),
    // `accumulated` has already been replaced wholesale with fresher server
    // data; blindly restoring a stale snapshot over it would clobber that
    // fresher state (or resurrect a card a fresh fetch legitimately
    // dropped, e.g. after a parentGuid change). The reset itself already
    // reflects the server's true state for a card whose PUT never landed,
    // so skipping the restore in that case is correct, not merely safe.
    if (this.generation() === token) {
      const failedGuids = new Set(failures.map((f) => f.guid));
      this.accumulated.update((cards) =>
        cards.map((c) => {
          if (!failedGuids.has(c.guid)) return c;
          const prior = priors.get(c.guid);
          return prior ?? c;
        }),
      );
    }
    const message = this.toMessage(failures[0].r.reason, 'Something went wrong.');
    const suffix = failures.length > 1 ? ` (and ${failures.length - 1} more)` : '';
    this.snack.open(`Couldn't move card — ${message}${suffix}`, 'Dismiss', { duration: 4000 });
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const m = (err as { message?: unknown }).message;
      if (typeof m === 'string') return m;
    }
    return fallback;
  }

  onCardClick(card: PageChildDetail): void {
    const pageType = card.pageType ? this.pageTypesMap()[card.pageType] ?? null : null;
    const data: CardSummaryDialogData = { card, pageType };
    this.dialog.open(CardSummaryDialog, { data });
  }

  async onLoadMore(): Promise<void> {
    const cursor = this.nextCursor();
    const parentGuid = this.parentGuidSig();
    if (!cursor || !parentGuid || this.paging()) return;
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
      this.loadedPages.update((n) => n + 1);
    } catch (err) {
      // Without this the failure was invisible: the button simply spun and
      // reset with nothing appended, and the rejection surfaced only as an
      // unhandled promise in the console. Toast it like every other failure
      // path in this view (see the drop-rollback toast above).
      if (this.generation() !== token) return;
      this.snack.open(
        `Couldn't load more cards — ${this.toMessage(err, 'Something went wrong.')}`,
        'Dismiss',
        { duration: 4000 },
      );
    } finally {
      this.loadingMore.set(false);
    }
  }
}
