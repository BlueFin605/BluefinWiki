import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/**
 * Root breakpoint service — the single source of responsive layout state
 * (DESIGN.md D1/D2).
 *
 * Wraps `@angular/cdk/layout` `BreakpointObserver` as signals. Every responsive
 * consumer in Phase 1b keys off `isDesktop()` and nothing else; `isTablet` /
 * `isMobile` are exposed for completeness but currently unused.
 *
 * `isDesktop` starts `true` on the first tick / during SSR so the app renders
 * the desktop layout immediately and never flashes the mobile layout on load.
 */
@Injectable({ providedIn: 'root' })
export class Breakpoint {
  private readonly observer = inject(BreakpointObserver);

  /** `true` when `(min-width: 1024px)` matches. Defaults to `true`. */
  readonly isDesktop: Signal<boolean> = toSignal(
    this.observer.observe('(min-width: 1024px)').pipe(map((state) => state.matches)),
    { initialValue: true },
  );

  /** `true` at 768px–1023.98px. Exposed, not consumed yet. Defaults to `false`. */
  readonly isTablet: Signal<boolean> = toSignal(
    this.observer
      .observe('(min-width: 768px) and (max-width: 1023.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** `true` at ≤767.98px. Exposed, not consumed yet. Defaults to `false`. */
  readonly isMobile: Signal<boolean> = toSignal(
    this.observer.observe('(max-width: 767.98px)').pipe(map((state) => state.matches)),
    { initialValue: false },
  );
}
