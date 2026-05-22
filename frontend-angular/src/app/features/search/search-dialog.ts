import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Search } from './search';
import type { WikiSearchResult } from './search.types';

type ScopeValue = 'all' | 'titles' | 'content';

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
const RESULT_LIMIT = 10;

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
          placeholder="Search wiki..."
          aria-label="Search wiki"
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
      </div>

      <div class="results" role="listbox" aria-label="Search results">
        @if (rawQuery().trim().length === 0) {
          <p class="hint">Start typing to search...</p>
        } @else if (state().status === 'error') {
          <p class="error">{{ state().error }}</p>
        } @else if (state().status === 'resolved' && state().results.length === 0) {
          <p class="hint">No results for "{{ rawQuery() }}".</p>
        } @else {
          @for (result of state().results; track result.pageId) {
            <button
              type="button"
              class="result"
              role="option"
              [attr.aria-label]="result.title"
              [attr.aria-selected]="false"
              (click)="onSelect(result)"
            >
              <div class="title">{{ result.title }}</div>
              <div class="path">{{ result.path }}</div>
              @if (result.snippet) {
                <div class="snippet">{{ result.snippet }}</div>
              }
            </button>
          }
          @if (state().results.length > 0) {
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
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #e5e7eb;
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
    .result {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      background: none;
      padding: 0.5rem 1rem;
      cursor: pointer;
    }
    .result:hover, .result:focus-visible {
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
  `],
})
export class SearchDialog {
  private readonly searchService = inject(Search);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef<SearchDialog, string | null>);

  protected readonly rawQuery = signal('');
  protected readonly scope = signal<ScopeValue>('all');
  protected readonly state = signal<SearchState>(IDLE_STATE);

  // Combine raw + scope into a tuple so a scope change also re-issues the search.
  private readonly trigger = computed(() => ({
    text: this.rawQuery(),
    scope: this.scope(),
  }));

  // Debounced + de-duped stream that fans out to the search service.
  private readonly debounced = toSignal(
    toObservable(this.trigger).pipe(
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(
        (a, b) => a.text === b.text && a.scope === b.scope,
      ),
      switchMap((trig) => this.run(trig.text, trig.scope)),
    ),
    { initialValue: IDLE_STATE },
  );

  constructor() {
    // Pipe debounced() into state() so the OnPush template re-reads cleanly.
    effect(() => {
      this.state.set(this.debounced());
    });
  }

  protected onQueryChange(value: string): void {
    this.rawQuery.set(value);
    if (!value.trim()) {
      this.state.set(IDLE_STATE);
    }
  }

  protected onScopeChange(value: ScopeValue): void {
    this.scope.set(value);
  }

  protected async onSelect(result: WikiSearchResult): Promise<void> {
    await this.router.navigate(['/pages', result.pageId]);
    this.dialogRef.close(result.pageId);
  }

  protected onClose(): void {
    this.dialogRef.close(null);
  }

  private async run(
    text: string,
    scope: ScopeValue,
  ): Promise<SearchState> {
    const trimmed = text.trim();
    if (!trimmed) {
      return IDLE_STATE;
    }
    this.state.set({ ...this.state(), status: 'loading' });
    try {
      const res = await this.searchService.search({
        text: trimmed,
        scope,
        limit: RESULT_LIMIT,
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
