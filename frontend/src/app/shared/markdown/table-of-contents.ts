import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { extractHeadings } from './extract-headings';

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
 * entry smooth-scrolls to the heading and sets `location.hash`.
 *
 * Fed the raw markdown (not the rendered DOM): it extracts the heading list with
 * the shared {@link extractHeadings} / `slugify`, then resolves each entry to a
 * live element with `document.getElementById(slug)` — the markdown renderer
 * already stamps the matching slug ids onto its headings.
 *
 * The rail renders nothing when there are fewer than {@link MIN_HEADINGS}
 * headings.
 *
 * Mobile (a collapsible bar) is out of scope here — Phase 1b step 1b.8 owns it.
 * The `compact` input is the seam it will drive.
 */
@Component({
  selector: 'wiki-toc',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <nav class="wiki-toc" [class.compact]="compact()" aria-label="Table of contents">
        <p class="wiki-toc-title">On this page</p>
        <ul>
          @for (h of headings(); track $index) {
            <li
              [attr.data-level]="h.level"
              [class.active]="h.slug === activeSlug()"
              [style.padding-left.rem]="(h.level - 2) * 0.75"
            >
              <a [attr.href]="'#' + h.slug" (click)="onEntryClick($event, h.slug)">{{ h.text }}</a>
            </li>
          }
        </ul>
      </nav>
    }
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
  `],
})
export class WikiTableOfContents {
  private readonly destroyRef = inject(DestroyRef);

  /** Raw markdown source of the previewed page. */
  readonly markdown = input.required<string>();

  /**
   * Compact / mobile presentation. Not yet wired to any responsive driver.
   * TODO(1b.8): drive from the Breakpoint service (step 1b.8 owns the mobile bar).
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

  private observer: IntersectionObserver | null = null;

  constructor() {
    // Re-wire the observer after every render where the heading list changes, so
    // it always tracks the current set of heading elements (which are rendered
    // by a sibling `wiki-markdown-renderer`, hence the after-render timing).
    afterRenderEffect(() => this.syncObserver());
    this.destroyRef.onDestroy(() => this.teardownObserver());
  }

  onEntryClick(event: Event, slug: string): void {
    event.preventDefault();
    const el = typeof document !== 'undefined' ? document.getElementById(slug) : null;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this._activeSlug.set(slug);
    try {
      window.location.hash = slug;
    } catch {
      // Some embedded contexts disallow hash writes — the scroll already ran.
    }
  }

  private syncObserver(): void {
    this.teardownObserver();

    const headings = this.headings();
    if (
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
