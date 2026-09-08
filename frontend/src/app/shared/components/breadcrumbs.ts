import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pages } from '../../features/pages/pages';

/**
 * Interim mobile-breakpoint media query for the `>3`-segment collapse gate.
 * TODO(1b.7): replace window.matchMedia with the Breakpoint service (step-1b.7).
 */
const MOBILE_BREAKPOINT_QUERY = '(max-width: 1023.98px)';

@Component({
  selector: 'wiki-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <a class="crumb" [routerLink]="['/pages']" title="Home">Home</a>
          <span class="sep" aria-hidden="true">/</span>
        </li>

        @if (collapsed()) {
          <li>
            <span
              class="crumb ellipsis"
              [title]="hiddenTitle()"
              aria-label="Show hidden breadcrumb segments"
              >…</span>
            <span class="sep" aria-hidden="true">/</span>
          </li>
        } @else {
          @for (a of ancestors(); track a.guid) {
            <li>
              <a class="crumb" [routerLink]="['/pages', a.guid]" [title]="a.title">{{ a.title }}</a>
              <span class="sep" aria-hidden="true">/</span>
            </li>
          }
        }

        <li class="current">
          <span class="crumb" [title]="currentTitle()" aria-current="page">{{ currentTitle() }}</span>
        </li>
      </ol>
    </nav>
  `,
  styles: [`
    :host { display: block; }
    .breadcrumbs { padding: 0.5rem 1rem; font-size: 0.875rem; color: #6b7280; }
    ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
    li { display: flex; align-items: center; min-width: 0; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .crumb {
      display: inline-block;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: bottom;
    }
    .ellipsis { color: #9ca3af; }
    .sep { color: #cbd5e1; padding: 0 0.25rem; }
    .current .crumb { font-weight: 500; color: #111827; }
  `],
})
export class Breadcrumbs {
  private readonly pages = inject(Pages);

  readonly guid = input.required<string>();
  readonly currentTitle = input.required<string>();

  private readonly guidSignal = computed(() => this.guid());
  private readonly resource = this.pages.ancestorsResource(this.guidSignal);

  protected readonly ancestors = computed(() => {
    if (this.resource.status() !== 'resolved') return [];
    return this.resource.value() ?? [];
  });

  /**
   * React parity: when the trail has more than three segments
   * (Home + ancestors + Current) *and* the viewport is below the mobile
   * breakpoint, the middle collapses to a static `…` — `Home ▸ … ▸ Current`.
   * The gate reads an interim `matchMedia`.
   * TODO(1b.7): replace window.matchMedia with the Breakpoint service (step-1b.7).
   */
  protected readonly collapsed = computed(() => {
    const segmentCount = this.ancestors().length + 2; // Home + ancestors + Current
    return segmentCount > 3 && this.matchesMobileBreakpoint();
  });

  /** Full text of the ancestors hidden behind the collapsed `…`. */
  protected readonly hiddenTitle = computed(() =>
    this.ancestors().map((a) => a.title).join(' / '),
  );

  /**
   * Interim viewport check for the collapse gate.
   * TODO(1b.7): replace window.matchMedia with the Breakpoint service (step-1b.7).
   */
  private matchesMobileBreakpoint(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches
    );
  }
}
