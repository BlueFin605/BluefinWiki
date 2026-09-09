import { signal, type Provider, type WritableSignal } from '@angular/core';

import { Breakpoint } from '../core/layout/breakpoint';

/**
 * Handle returned by {@link provideBreakpointStub}. Spread `providers` into a
 * `TestBed.configureTestingModule({ providers: [...] })` call, then drive the
 * layout state at runtime through the writable `isDesktop` / `isTablet` /
 * `isMobile` signals — the component under test sees the change because DI hands
 * it these exact signal instances.
 */
export interface BreakpointStub {
  /** Provider that replaces the real {@link Breakpoint} with the fake. */
  readonly providers: Provider[];
  /** Writable backing signal for `Breakpoint.isDesktop`. */
  readonly isDesktop: WritableSignal<boolean>;
  /** Writable backing signal for `Breakpoint.isTablet`. */
  readonly isTablet: WritableSignal<boolean>;
  /** Writable backing signal for `Breakpoint.isMobile`. */
  readonly isMobile: WritableSignal<boolean>;
  /** The fake instance handed to DI, typed as `Breakpoint`. */
  readonly instance: Breakpoint;
}

/**
 * Shared test double for the {@link Breakpoint} service. Every Phase 1b spec
 * that renders a responsive component uses this instead of wiring a fake
 * `BreakpointObserver`.
 *
 * ```ts
 * const bp = provideBreakpointStub(false); // start below 1024px
 * TestBed.configureTestingModule({ providers: [bp.providers, OtherProviders] });
 * // ...render the component...
 * bp.isDesktop.set(true);  // component reacts on the next change detection
 * ```
 *
 * @param isDesktop initial value for `isDesktop()` (default `true`, i.e. desktop)
 */
export function provideBreakpointStub(isDesktop = true): BreakpointStub {
  const isDesktopSig = signal(isDesktop);
  const isTabletSig = signal(false);
  const isMobileSig = signal(false);

  const instance = {
    isDesktop: isDesktopSig,
    isTablet: isTabletSig,
    isMobile: isMobileSig,
  } as unknown as Breakpoint;

  return {
    providers: [{ provide: Breakpoint, useValue: instance }],
    isDesktop: isDesktopSig,
    isTablet: isTabletSig,
    isMobile: isMobileSig,
    instance,
  };
}
