import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type { Observable } from 'rxjs';

import { Breakpoint } from './breakpoint';

const DESKTOP_Q = '(min-width: 1024px)';
const TABLET_Q = '(min-width: 768px) and (max-width: 1023.98px)';
const MOBILE_Q = '(max-width: 767.98px)';

/**
 * Fake `BreakpointObserver` whose `observe(query)` returns a per-query
 * `Subject<BreakpointState>` that emits nothing until the test calls `emit()`.
 * That lets a spec assert the `toSignal` initial values before any emission.
 */
class FakeBreakpointObserver {
  private readonly subjects = new Map<string, Subject<BreakpointState>>();

  observe(query: string | readonly string[]): Observable<BreakpointState> {
    return this.subjectFor(query).asObservable();
  }

  emit(query: string, matches: boolean): void {
    this.subjectFor(query).next({ matches, breakpoints: { [query]: matches } });
  }

  private subjectFor(query: string | readonly string[]): Subject<BreakpointState> {
    const key = Array.isArray(query) ? query.join(',') : (query as string);
    let subject = this.subjects.get(key);
    if (!subject) {
      subject = new Subject<BreakpointState>();
      this.subjects.set(key, subject);
    }
    return subject;
  }
}

describe('Breakpoint service', () => {
  let fake: FakeBreakpointObserver;

  function makeService(): Breakpoint {
    fake = new FakeBreakpointObserver();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [Breakpoint, { provide: BreakpointObserver, useValue: fake }],
    });
    return TestBed.inject(Breakpoint);
  }

  it('defaults isDesktop to true before the first emission', () => {
    const bp = makeService();
    expect(bp.isDesktop()).toBe(true);
  });

  it('defaults isTablet and isMobile to false before the first emission', () => {
    const bp = makeService();
    expect(bp.isTablet()).toBe(false);
    expect(bp.isMobile()).toBe(false);
  });

  it('isDesktop() reflects the matches flag of the (min-width: 1024px) query', () => {
    const bp = makeService();

    fake.emit(DESKTOP_Q, false);
    expect(bp.isDesktop()).toBe(false);

    fake.emit(DESKTOP_Q, true);
    expect(bp.isDesktop()).toBe(true);
  });

  it('isTablet() reflects the 768-1023.98px query', () => {
    const bp = makeService();

    fake.emit(TABLET_Q, true);
    expect(bp.isTablet()).toBe(true);

    fake.emit(TABLET_Q, false);
    expect(bp.isTablet()).toBe(false);
  });

  it('isMobile() reflects the (max-width: 767.98px) query', () => {
    const bp = makeService();

    fake.emit(MOBILE_Q, true);
    expect(bp.isMobile()).toBe(true);
  });

  it('updates the three signals independently', () => {
    const bp = makeService();

    fake.emit(TABLET_Q, true);

    // Only the tablet signal moved; the others keep their defaults.
    expect(bp.isTablet()).toBe(true);
    expect(bp.isDesktop()).toBe(true);
    expect(bp.isMobile()).toBe(false);

    fake.emit(DESKTOP_Q, false);
    expect(bp.isDesktop()).toBe(false);
    expect(bp.isTablet()).toBe(true);
    expect(bp.isMobile()).toBe(false);
  });
});
