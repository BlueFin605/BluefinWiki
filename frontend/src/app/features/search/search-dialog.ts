import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RATE_LIMIT_MESSAGE, RateLimitExceededError, Search, hasMoreResults } from './search';
import { moveSelection } from './move-selection';
import { addRecent, readRecentSearches, removeRecent, writeRecentSearches } from './recent-searches';
import type { SearchPageSize, WikiSearchResult } from './search.types';

type ScopeValue = 'all' | 'titles' | 'content';

const PAGE_SIZES: readonly SearchPageSize[] = [10, 25, 50];

interface SearchState {
  status: 'idle' | 'loading' | 'resolved' | 'error';
  results: readonly WikiSearchResult[];
  totalResults: number;
  executionTimeMs: number;
  error: string | null;
}

const IDLE_STATE: SearchState = {
  status: 'idle',
  results: [],
  totalResults: 0,
  executionTimeMs: 0,
  error: null,
};

const DEBOUNCE_MS = 200;
const DEFAULT_PAGE_SIZE: SearchPageSize = 10;

@Component({
  selector: 'wiki-search-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-dialog" role="dialog" aria-label="Search wiki">
      <div class="input-row">
        <mat-icon aria-hidden="true">search</mat-icon>
        <input
          type="text"
          [(ngModel)]="rawQuery"
          (ngModelChange)="onQueryChange($event)"
          (keydown)="onKeydown($event)"
          placeholder="Search wiki..."
          aria-label="Search wiki"
          role="combobox"
          aria-controls="search-results-listbox"
          [attr.aria-expanded]="resultsOpen()"
          [attr.aria-activedescendant]="activeDescendant()"
          maxlength="500"
          #searchInput
        />
        @if (state().status === 'loading') {
          <mat-spinner diameter="18" aria-label="Searching" />
        }
        <button
          mat-icon-button
          aria-label="Close search"
          (click)="onClose()"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="scope-row">
        <mat-button-toggle-group
          [value]="scope()"
          (change)="onScopeChange($any($event.value))"
          aria-label="Search scope"
        >
          <mat-button-toggle value="all">All</mat-button-toggle>
          <mat-button-toggle value="titles">Titles</mat-button-toggle>
          <mat-button-toggle value="content">Content</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-button-toggle-group
          class="page-size-group"
          [value]="pageSize()"
          (change)="onPageSizeChange($any($event.value))"
          aria-label="Results per page"
        >
          @for (size of pageSizes; track size) {
            <mat-button-toggle [value]="size">{{ size }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
      </div>

      <div
        id="search-results-listbox"
        class="results"
        role="listbox"
        aria-label="Search results"
        #resultsList
      >
        @if (rateLimited() && rawQuery().trim().length > 0) {
          <p class="error">{{ rateLimitMessage }}</p>
        }
        @if (rawQuery().trim().length === 0) {
          @if (recentSearches().length > 0) {
            <div class="recent-searches">
              <div class="recent-header">
                <span>Recent searches</span>
                <button type="button" class="clear-all-btn" (click)="onClearRecent()">
                  Clear all
                </button>
              </div>
              @for (term of recentSearches(); track term) {
                <div class="recent-item">
                  <button
                    type="button"
                    class="recent-term"
                    (click)="onSelectRecent(term)"
                  >
                    <mat-icon aria-hidden="true">history</mat-icon>
                    {{ term }}
                  </button>
                  <button
                    type="button"
                    class="recent-remove"
                    [attr.aria-label]="'Remove recent search ' + term"
                    (click)="onRemoveRecent(term)"
                  >
                    <mat-icon aria-hidden="true">close</mat-icon>
                  </button>
                </div>
              }
            </div>
          } @else {
            <p class="hint">Start typing to search...</p>
          }
        } @else if (state().status === 'error') {
          <p class="error">{{ state().error }}</p>
        } @else if (state().status === 'resolved' && state().results.length === 0) {
          <p class="hint">No results for "{{ rawQuery() }}".</p>
        } @else {
          @for (result of state().results; track result.pageId; let i = $index) {
            <button
              type="button"
              class="result"
              [class.selected]="i === selectedIndex()"
              role="option"
              [id]="'search-result-' + i"
              [attr.aria-label]="result.title"
              [attr.aria-selected]="i === selectedIndex()"
              (click)="onSelect(result)"
              (mouseenter)="selectedIndex.set(i)"
            >
              <div class="title">{{ result.title }}</div>
              <div class="path">{{ result.path }}</div>
              @if (result.snippet) {
                <div class="snippet">{{ result.snippet }}</div>
              }
            </button>
          }
          @if (hasMore()) {
            <div class="load-more-row">
              <button
                type="button"
                class="load-more-btn"
                #loadMoreBtn
                [disabled]="loadingMore()"
                (click)="onLoadMore()"
              >
                {{
                  loadingMore()
                    ? 'Loading…'
                    : 'Load more results (' + state().results.length + ' of ' + state().totalResults + ')'
                }}
              </button>
            </div>
          } @else if (state().results.length > 0) {
            <div class="footer">
              {{ state().totalResults }} result(s) in {{ state().executionTimeMs }}ms
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .search-dialog {
      display: flex;
      flex-direction: column;
      min-width: 480px;
      max-width: 640px;
      max-height: 70vh;
    }
    .input-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .input-row input {
      flex: 1;
      border: 0;
      outline: none;
      font-size: 1rem;
      background: transparent;
    }
    .scope-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .page-size-group {
      font-size: 0.75rem;
    }
    .results {
      flex: 1;
      overflow-y: auto;
      padding: 0.25rem 0;
      min-height: 120px;
    }
    .hint, .error {
      padding: 1rem;
      color: #6b7280;
      text-align: center;
      font-size: 0.875rem;
    }
    .error { color: #b91c1c; }
    .recent-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
      color: #6b7280;
    }
    .clear-all-btn {
      border: 0;
      background: none;
      color: #2563eb;
      font-size: 0.75rem;
      cursor: pointer;
      padding: 0;
    }
    .recent-item {
      display: flex;
      align-items: center;
    }
    .recent-term {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-align: left;
      border: 0;
      background: none;
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: 0.875rem;
      color: #111827;
    }
    .recent-term:hover, .recent-term:focus-visible {
      background: #f3f4f6;
    }
    .recent-term mat-icon {
      color: #9ca3af;
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
    }
    .recent-remove {
      border: 0;
      background: none;
      cursor: pointer;
      padding: 0.25rem 0.75rem;
      color: #9ca3af;
      display: flex;
      align-items: center;
    }
    .recent-remove:hover, .recent-remove:focus-visible {
      color: #4b5563;
    }
    .recent-remove mat-icon {
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
    }
    .result {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      background: none;
      padding: 0.5rem 1rem;
      cursor: pointer;
    }
    .result:hover, .result:focus-visible, .result.selected {
      background: #f3f4f6;
    }
    .title { font-weight: 500; color: #111827; }
    .path { font-size: 0.75rem; color: #6b7280; margin-top: 0.125rem; }
    .snippet { font-size: 0.875rem; color: #4b5563; margin-top: 0.25rem; }
    .footer {
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
    }
    .load-more-row {
      display: flex;
      justify-content: center;
      padding: 0.5rem 1rem;
      border-top: 1px solid #e5e7eb;
    }
    .load-more-btn {
      padding: 0.375rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background: #fff;
      font-size: 0.8125rem;
      cursor: pointer;
    }
    .load-more-btn:disabled {
      cursor: default;
      opacity: 0.7;
    }
  `],
})
export class SearchDialog {
  private readonly searchService = inject(Search);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef<SearchDialog, string | null>);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSizes = PAGE_SIZES;

  protected readonly rawQuery = signal('');
  protected readonly scope = signal<ScopeValue>('all');
  protected readonly pageSize = signal<SearchPageSize>(DEFAULT_PAGE_SIZE);
  protected readonly state = signal<SearchState>(IDLE_STATE);

  /** True while an imperative "Load more" fetch (appending a page) is in flight. */
  protected readonly loadingMore = signal(false);

  /**
   * True while `Search`'s client-side rate limiter (step 6.3) is suppressing
   * dispatched requests — read directly from the service, which is the
   * single choke point both the debounced query pipeline and "Load more"
   * dispatch through, so this covers both. Drives the "Too many searches"
   * message in the template; hidden while the query box is empty.
   */
  protected readonly rateLimited = this.searchService.rateLimited;

  /** Shared with `RateLimitExceededError` so the two copies can't drift. */
  protected readonly rateLimitMessage = RATE_LIMIT_MESSAGE;

  /** `-1` when nothing is highlighted. Moved by {@link moveSelection}, hover, and Enter/Ctrl+Enter. */
  protected readonly selectedIndex = signal(-1);

  /**
   * Persisted recent-search terms (step 6.4), most-recent-first. Seeded from
   * `localStorage` at construction; every mutation below writes straight
   * back out via {@link writeRecentSearches} so this signal and storage
   * never drift. Rendered in place of the "Start typing..." hint while the
   * query box is empty (see the template) — the hint still shows when it's
   * empty too (nothing recent to offer yet).
   */
  protected readonly recentSearches = signal<string[]>(readRecentSearches());

  /**
   * Bumped every time the debounce/switchMap pipeline below lands a fresh
   * page one (a new query, scope change, or page-size change — anything that
   * legitimately restarts pagination from scratch). `onLoadMore()` captures
   * this before its request goes out and discards the response if it no
   * longer matches when the response arrives: the switchMap pipeline cancels
   * a *stale page-one* request for us at the RxJS level, but "Load more" is
   * a separate imperative fetch outside that pipeline, so a slow append for
   * an old query could otherwise land after — and clobber — a newer reset
   * (e.g. the user kept typing while "Load more" was still in flight).
   */
  private readonly generation = signal(0);

  // Read via a computed (not `state().results` directly) so effects below only
  // re-run when the results *array reference* actually changes — e.g. not on
  // every idle → loading → resolved status flip for the same result set.
  private readonly results = computed(() => this.state().results);

  /** True once more results exist beyond what's currently loaded (accumulated). */
  protected readonly hasMore = computed(
    () => this.state().status === 'resolved' && hasMoreResults(this.state()),
  );

  protected readonly activeDescendant = computed(() => {
    const i = this.selectedIndex();
    return i >= 0 ? `search-result-${i}` : null;
  });

  /**
   * Whether the results listbox currently has selectable options — drives
   * `aria-expanded`. Keyed only off `results.length`, not `status`: while a
   * new search is `loading`, the previous result set's rows are still
   * rendered (see the template), so the listbox stays "expanded" until that
   * changes.
   */
  protected readonly resultsOpen = computed(() => this.results().length > 0);

  // Combine raw + scope + pageSize into a tuple so a scope or page-size
  // change also re-issues the search (always from offset 0 — see `run`).
  private readonly trigger = computed(() => ({
    text: this.rawQuery(),
    scope: this.scope(),
    pageSize: this.pageSize(),
  }));

  // Debounced + de-duped stream that fans out to the search service.
  private readonly debounced = toSignal(
    toObservable(this.trigger).pipe(
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(
        (a, b) => a.text === b.text && a.scope === b.scope && a.pageSize === b.pageSize,
      ),
      switchMap((trig) => this.run(trig.text, trig.scope, trig.pageSize)),
      // `run()` returns `null` for a rate-limited (suppressed) dispatch —
      // drop it here rather than letting it re-enter the pipeline. A
      // suppressed dispatch is a genuine no-op (see `run`'s catch, which
      // reverts `state` directly and synchronously), so it must never reach
      // `toSignal`/the constructor's `effect()` below: that effect bumps
      // `generation` on every emission it sees, by *reference*, regardless
      // of content — and once `onLoadMore()` has appended a page (which
      // mutates `state` directly, bypassing this pipeline entirely), the
      // `before` reference `run()` would otherwise push back through here is
      // no longer reference-equal to whatever `toSignal` last cached, so it
      // would read as a "real" change and spuriously reset the selection.
      // Filtering the no-op out here sidesteps that reference-equality trap
      // altogether instead of depending on it.
      filter((result): result is SearchState => result !== null),
    ),
    { initialValue: IDLE_STATE },
  );

  private readonly loadMoreBtnEl = viewChild('loadMoreBtn', { read: ElementRef });
  private readonly resultsListEl = viewChild('resultsList', { read: ElementRef });
  private loadMoreObserver: IntersectionObserver | null = null;

  constructor() {
    // Pipe debounced() into state() so the OnPush template re-reads cleanly.
    // This is the ONLY place `state` is replaced wholesale with a fresh page
    // one, so it's also the right place to bump `generation` (see its doc
    // comment) — `onLoadMore()`'s in-place append below deliberately does
    // NOT touch `generation`.
    effect(() => {
      this.state.set(this.debounced());
      this.generation.update((g) => g + 1);
    });

    // Reset the highlighted row whenever a genuinely new result set arrives
    // (including going back to empty) — a stale index from the previous
    // query must never carry over. Keyed off `generation`, not `results()`:
    // an appended "Load more" page also changes the `results` array
    // reference but must NOT reset the user's current selection.
    effect(() => {
      this.generation();
      this.selectedIndex.set(-1);
    });

    // Keep the highlighted row visible as selection moves via keyboard/hover.
    afterRenderEffect(() => {
      const results = this.results();
      const i = this.selectedIndex();
      if (i < 0 || i >= results.length) return;
      const el = document.getElementById(`search-result-${i}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    });

    // Wire/re-wire an IntersectionObserver on the "Load more" control so it
    // auto-fires when scrolled near the bottom of the results list, in
    // addition to being clickable. Re-runs whenever the control mounts,
    // unmounts (hasMore flips), or the scroll container changes.
    afterRenderEffect(() => this.syncLoadMoreObserver());
    this.destroyRef.onDestroy(() => this.teardownLoadMoreObserver());
  }

  protected onQueryChange(value: string): void {
    this.rawQuery.set(value);
    if (!value.trim()) {
      // Bypasses the debounce/switchMap pipeline entirely (there's nothing
      // to search), so it must also bump `generation` itself here — the
      // pipeline effect that normally does this won't run for another
      // DEBOUNCE_MS, and the selection-reset effect is keyed off
      // `generation`, not `results()`. Without this, `selectedIndex` (and
      // `aria-activedescendant`) would keep pointing at a row that just
      // vanished from the DOM until the debounce eventually fires.
      this.state.set(IDLE_STATE);
      this.generation.update((g) => g + 1);
    }
  }

  protected onScopeChange(value: ScopeValue): void {
    this.scope.set(value);
  }

  /** Page-size selector change — re-runs the search from the start (offset 0). */
  protected onPageSizeChange(value: SearchPageSize): void {
    this.pageSize.set(value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const key = event.key;
    const results = this.results();
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      if (results.length === 0) return;
      event.preventDefault();
      this.selectedIndex.set(moveSelection(this.selectedIndex(), key, results.length));
      return;
    }
    if (key === 'Enter') {
      const selected = results[this.selectedIndex()];
      if (!selected) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        // Open in a new tab; the dialog and its result list stay open so the
        // user can keep browsing (matches React).
        window.open('/pages/' + selected.pageId, '_blank');
        return;
      }
      void this.onSelect(selected);
    }
  }

  protected async onSelect(result: WikiSearchResult): Promise<void> {
    // Recorded on selection, not on every keystroke (step 6.4) — the term
    // that actually produced a result the user picked, not merely typed.
    this.recordRecent(this.rawQuery());
    await this.router.navigate(['/pages', result.pageId]);
    this.dialogRef.close(result.pageId);
  }

  protected onClose(): void {
    this.dialogRef.close(null);
  }

  /** Clicking a recent-search term re-runs it, same as typing it. */
  protected onSelectRecent(term: string): void {
    this.onQueryChange(term);
  }

  /** Removes just this one recent-search entry (the row's "×" control). */
  protected onRemoveRecent(term: string): void {
    const next = removeRecent(this.recentSearches(), term);
    this.recentSearches.set(next);
    writeRecentSearches(next);
  }

  /** "Clear all" — empties the recent-searches list. */
  protected onClearRecent(): void {
    this.recentSearches.set([]);
    writeRecentSearches([]);
  }

  /** Records `term` as the most-recent search (deduped + capped — see `addRecent`). */
  private recordRecent(term: string): void {
    const next = addRecent(this.recentSearches(), term);
    this.recentSearches.set(next);
    writeRecentSearches(next);
  }

  /**
   * Fetches the next page (offset = however many results are already
   * accumulated) and appends it — clicked explicitly, or auto-fired by the
   * IntersectionObserver in {@link syncLoadMoreObserver}. Guarded by
   * `loadingMore`/`hasMore` so a double click or an overlapping IO callback
   * can't fire a second overlapping request, and by `generation` so a
   * response that outlives a newer reset is discarded (see its doc comment).
   */
  protected async onLoadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore()) return;
    const trimmed = this.rawQuery().trim();
    if (!trimmed) return;

    const before = this.state();
    const token = this.generation();
    this.loadingMore.set(true);
    try {
      const res = await this.searchService.search({
        text: trimmed,
        scope: this.scope(),
        limit: this.pageSize(),
        offset: before.results.length,
      });
      if (this.generation() !== token) return;
      this.state.set({
        ...before,
        results: [...before.results, ...res.results],
        totalResults: res.totalResults,
        executionTimeMs: res.executionTimeMs,
      });
    } catch {
      // Leave the already-loaded results on screen; the "Load more" button
      // stays put (hasMore is unchanged) so the user can simply retry.
    } finally {
      this.loadingMore.set(false);
    }
  }

  /** Re-wires the "Load more" auto-scroll observer against the current DOM. */
  private syncLoadMoreObserver(): void {
    this.teardownLoadMoreObserver();
    if (typeof IntersectionObserver === 'undefined') return;
    const btn = this.loadMoreBtnEl()?.nativeElement as HTMLElement | undefined;
    if (!btn) return;
    const root = (this.resultsListEl()?.nativeElement as HTMLElement | undefined) ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void this.onLoadMore();
      },
      { root, threshold: 0 },
    );
    observer.observe(btn);
    this.loadMoreObserver = observer;
  }

  private teardownLoadMoreObserver(): void {
    this.loadMoreObserver?.disconnect();
    this.loadMoreObserver = null;
  }

  /**
   * Returns `null` (rather than a `SearchState`) for a suppressed
   * (rate-limited) dispatch — the `debounced` pipeline above filters that
   * out before it reaches `toSignal`, so it can never masquerade as a "real"
   * state transition. See the `filter` call above for why that matters.
   */
  private async run(
    text: string,
    scope: ScopeValue,
    pageSize: SearchPageSize,
  ): Promise<SearchState | null> {
    const trimmed = text.trim();
    if (!trimmed) {
      return IDLE_STATE;
    }
    const before = this.state();
    this.state.set({ ...before, status: 'loading' });
    try {
      const res = await this.searchService.search({
        text: trimmed,
        scope,
        limit: pageSize,
        offset: 0,
      });
      return {
        status: 'resolved',
        results: res.results,
        totalResults: res.totalResults,
        executionTimeMs: res.executionTimeMs,
        error: null,
      };
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        // Suppressed dispatch: revert the 'loading' flip above directly and
        // synchronously, and leave whatever was previously on screen alone.
        // Deliberately does NOT flow back through the debounced/toSignal
        // pipeline (return null, filtered out above) — nothing actually
        // changed, so it must not be able to bump `generation` or reset the
        // selection. The `rateLimited` signal (read straight off `Search`)
        // drives the banner instead of a generic error state.
        this.state.set(before);
        return null;
      }
      return {
        status: 'error',
        results: [],
        totalResults: 0,
        executionTimeMs: 0,
        error: err instanceof Error ? err.message : 'Search failed',
      };
    }
  }
}
