import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { extractHeadings } from './extract-headings';
import { scrollToSlug } from './scroll-to-slug';

/** Minimum h2–h6 headings before the rail is shown at all (React parity). */
const MIN_HEADINGS = 3;

/**
 * `rootMargin` biased so a heading only counts as "active" once it is within the
 * top ~30% of the viewport — i.e. the heading nearest the top wins, rather than
 * whatever is dead-centre. Matches React's TableOfContents.
 */
const ACTIVE_ROOT_MARGIN = '0px 0px -70% 0px';

/**
 * Desktop "On this page" table of contents — a sticky ~224px right rail listing
 * the h2–h6 headings of the rendered markdown, nested by level, with the
 * currently-visible section highlighted via `IntersectionObserver`. Clicking an
 * entry smooth-scrolls to the heading and reflects the slug in the URL fragment
 * via `history.replaceState` (no history entry) — see {@link scrollToSlug}.
 *
 * Fed the raw markdown (not the rendered DOM): it extracts the heading list with
 * the shared {@link extractHeadings} / `slugify`, then resolves each entry to a
 * live element with `document.getElementById(slug)` — the markdown renderer
 * already stamps the matching slug ids onto its headings.
 *
 * Renders nothing when there are fewer than {@link MIN_HEADINGS} headings, at any
 * width / any `compact` value.
 *
 * Mobile (`compact()`, driven by `page-detail` from `!bp.isDesktop()` — step
 * 1b.8): a full-width bar above the preview, **collapsed by default** and
 * labelled "On this page". Tapping the bar header toggles {@link expanded};
 * while collapsed the entry list is not in the DOM. Picking an entry does the
 * same smooth-scroll as the rail and then re-collapses the bar. The
 * active-highlight `IntersectionObserver` does not run in compact mode — the
 * collapsed bar has no visible list to highlight, and the bar re-collapses on
 * every pick — so it is torn down whenever `compact()` is true and re-wired if
 * the viewport grows back to desktop.
 */
@Component({
  selector: 'wiki-toc',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.compact]': 'compact()' },
  template: `
    @if (visible()) {
      @if (compact()) {
        <nav class="wiki-toc compact" aria-label="Table of contents">
          <button
            type="button"
            class="wiki-toc-bar"
            [attr.aria-expanded]="expanded()"
            (click)="toggleExpanded()"
          >
            On this page
          </button>
          @if (expanded()) {
            <ng-container [ngTemplateOutlet]="entryList" />
          }
        </nav>
      } @else {
        <nav class="wiki-toc" aria-label="Table of contents">
          <p class="wiki-toc-title">On this page</p>
          <ng-container [ngTemplateOutlet]="entryList" />
        </nav>
      }
    }

    <ng-template #entryList>
      <ul>
        @for (h of headings(); track $index) {
          <li
            [attr.data-level]="h.level"
            [class.active]="h.slug === activeSlug()"
            [style.padding-left.rem]="(h.level - 2) * 0.75"
          >
            <a
              [attr.href]="'#' + h.slug"
              [attr.aria-current]="h.slug === activeSlug() ? 'location' : null"
              (click)="onEntryClick($event, h.slug)"
            >{{ h.text }}</a>
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: [`
    /*
     * The rail sticks as the preview scrolls. The host is the sticky element:
     * its containing block is the flex row it sits in (\`.view-with-toc\` /
     * \`.preview-pane\`), whose height tracks the tall markdown renderer beside
     * it, so a short \`flex-start\`-aligned host has scroll range within it.
     * \`align-self: flex-start\` guarantees the host is not stretched to the full
     * row height (which would leave sticky nothing to travel over).
     */
    :host {
      display: block;
      position: sticky;
      top: 1rem;
      align-self: flex-start;
      max-height: calc(100vh - 2rem);
      overflow-y: auto;
    }
    .wiki-toc {
      width: 224px;
      font-size: 0.8125rem;
      line-height: 1.5;
    }
    .wiki-toc-title {
      margin: 0 0 0.5rem;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
    }
    .wiki-toc ul { list-style: none; margin: 0; padding: 0; }
    .wiki-toc li { border-left: 2px solid transparent; }
    .wiki-toc li.active { border-left-color: #2563eb; }
    .wiki-toc a {
      display: block;
      padding: 0.125rem 0.5rem;
      color: #6b7280;
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .wiki-toc a:hover { color: #111827; }
    .wiki-toc li.active > a { color: #2563eb; font-weight: 500; }

    /*
     * Compact / mobile (step 1b.8): a full-width collapsible bar, not a sticky
     * rail. The host stops being a sticky, width-constrained column; the layout
     * that stacks it above the preview lives in \`page-detail\`'s responsive CSS.
     */
    :host(.compact) {
      position: static;
      top: auto;
      align-self: stretch;
      max-height: none;
      overflow: visible;
    }
    .wiki-toc.compact { width: 100%; }
    .wiki-toc-bar {
      display: block;
      width: 100%;
      box-sizing: border-box;
      text-align: left;
      padding: 0.5rem 0.75rem;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      background: #f9fafb;
      font: inherit;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      cursor: pointer;
    }
    .wiki-toc-bar:hover { color: #111827; }
    .wiki-toc.compact ul { margin-top: 0.5rem; }
  `],
})
export class WikiTableOfContents {
  private readonly destroyRef = inject(DestroyRef);

  /** Raw markdown source of the previewed page. */
  readonly markdown = input.required<string>();

  /**
   * Compact / mobile presentation — a collapsible "On this page" bar instead of
   * the sticky rail. Driven by `page-detail` from `!bp.isDesktop()` (step 1b.8).
   */
  readonly compact = input<boolean>(false);

  protected readonly headings = computed(() => extractHeadings(this.markdown()), {
    // Value equality: editing prose in split mode re-runs `extractHeadings` on
    // every keystroke, but the heading list rarely changes — so the template
    // and the observer-sync `afterRenderEffect` below only react to real edits
    // to the headings themselves.
    equal: (a, b) =>
      a.length === b.length &&
      a.every((h, i) => h.level === b[i].level && h.slug === b[i].slug && h.text === b[i].text),
  });
  protected readonly visible = computed(() => this.headings().length >= MIN_HEADINGS);

  private readonly _activeSlug = signal<string | null>(null);
  protected readonly activeSlug = this._activeSlug.asReadonly();

  /**
   * Compact-bar open state. Collapsed by default; irrelevant to the rail.
   * Sourced on `compact()` so any breakpoint change — including
   * mobile → desktop → mobile on the same instance — snaps it back to collapsed
   * rather than reappearing expanded.
   */
  private readonly _expanded = linkedSignal(() => {
    this.compact();
    return false;
  });
  protected readonly expanded = this._expanded.asReadonly();

  private observer: IntersectionObserver | null = null;

  constructor() {
    // Re-wire the observer after every render where the heading list changes, so
    // it always tracks the current set of heading elements (which are rendered
    // by a sibling `wiki-markdown-renderer`, hence the after-render timing).
    afterRenderEffect(() => this.syncObserver());
    this.destroyRef.onDestroy(() => this.teardownObserver());
  }

  /** Compact-bar header tap — toggle the entry list. */
  toggleExpanded(): void {
    this._expanded.update((v) => !v);
  }

  onEntryClick(event: Event, slug: string): void {
    event.preventDefault();
    this._activeSlug.set(slug);
    // Shared "smooth scroll + reflect hash without a history entry" — a bare
    // `location.hash =` here would instant-jump over the smooth scroll and add a
    // history entry per click.
    scrollToSlug(slug);
    // Compact bar: re-collapse after the pick (the rail stays put).
    if (this.compact()) this._expanded.set(false);
  }

  private syncObserver(): void {
    this.teardownObserver();

    const headings = this.headings();
    if (
      // Compact mode has no persistent visible list to highlight — skip the
      // observer entirely (re-wired via `afterRenderEffect` if `compact` flips).
      this.compact() ||
      headings.length < MIN_HEADINGS ||
      typeof document === 'undefined' ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => this.onIntersect(entries),
      { rootMargin: ACTIVE_ROOT_MARGIN, threshold: 0 },
    );
    for (const h of headings) {
      const el = document.getElementById(h.slug);
      if (el) observer.observe(el);
    }
    this.observer = observer;
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    const topMost = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (topMost?.target.id) {
      this._activeSlug.set(topMost.target.id);
    }
  }

  private teardownObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
