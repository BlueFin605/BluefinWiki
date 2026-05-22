import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { Pages, type PageSearchResult } from '../pages/pages';

@Component({
  selector: 'wiki-link-autocomplete',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="autocomplete"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
        role="listbox"
        aria-label="Page suggestions"
      >
        @for (item of itemsSafe(); track item.guid; let i = $index) {
          <button
            type="button"
            class="item"
            [class.selected]="i === selectedIndex()"
            (click)="selectIndex(i)"
            (mouseenter)="selectedIndex.set(i)"
            role="option"
            [attr.aria-selected]="i === selectedIndex()"
          >
            <span class="title">{{ item.title }}</span>
            @if (item.path) {
              <span class="path">{{ item.path }}</span>
            }
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .autocomplete {
      position: fixed;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 100;
      min-width: 240px;
      max-width: 360px;
      max-height: 320px;
      overflow-y: auto;
    }
    .item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 0;
      background: none;
      cursor: pointer;
      text-align: left;
    }
    .item.selected,
    .item:hover { background: #dbeafe; }
    .title { font-weight: 500; color: #1e293b; }
    .path { font-size: 0.75rem; color: #6b7280; }
  `],
})
export class LinkAutocomplete {
  private readonly pages = inject(Pages);

  readonly query = input.required<string>();
  readonly position = input.required<{ top: number; left: number }>();
  readonly visible = input.required<boolean>();
  readonly pick = output<PageSearchResult>();
  readonly dismiss = output<void>();

  protected readonly selectedIndex = signal(0);

  // Debounced query → drives the search resource.
  private readonly query$ = toObservable(this.query).pipe(
    debounceTime(200),
    distinctUntilChanged(),
  );
  private readonly debouncedQuery = toSignal(
    this.query$.pipe(switchMap((q) => Promise.resolve(q))),
    { initialValue: '' },
  );

  protected readonly results = this.pages.pageSearchResource(this.debouncedQuery);

  protected readonly itemsSafe = computed<readonly PageSearchResult[]>(() => {
    // value() throws when the resource is in error state (e.g. empty query
    // sentinel). Guard via status.
    if (this.results.status() === 'error' || this.results.isLoading()) return [];
    return this.results.value() ?? [];
  });

  protected readonly open = computed(() => this.visible() && this.itemsSafe().length > 0);

  constructor() {
    // Reset highlighted index when the result set changes.
    effect(() => {
      void this.itemsSafe();
      this.selectedIndex.set(0);
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.visible()) return;
    const items = this.itemsSafe();
    const len = items.length;
    if (len === 0 && event.key !== 'Escape') return;
    if (event.key === 'ArrowDown') {
      this.selectedIndex.update((i) => (i + 1) % len);
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.selectedIndex.update((i) => (i - 1 + len) % len);
      event.preventDefault();
    } else if (event.key === 'Enter') {
      this.selectIndex(this.selectedIndex());
      event.preventDefault();
    } else if (event.key === 'Escape') {
      this.dismiss.emit();
      event.preventDefault();
    }
  }

  selectIndex(i: number): void {
    const item = this.itemsSafe()[i];
    if (item) this.pick.emit(item);
  }
}
