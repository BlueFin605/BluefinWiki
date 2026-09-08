# Step 1b.1 — Breakpoint service

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md D1, D2 |
| Gap refs | §0.5 (`useMediaQuery.ts`); F4 |
| Impact | 🔴 Functional (foundation) |
| Depends on | — |
| Est. size | S |

## Problem

No breakpoint / media-query code exists anywhere in the app.
`@angular/cdk/layout` is installed but unused.

## Target behaviour

A root `Breakpoint` service exposing signals:

- `isDesktop: Signal<boolean>` — `true` when `(min-width: 1024px)` matches.
  **First tick / SSR default = `true`** (assume desktop; avoids a mobile-layout
  flash on load).
- `isTablet: Signal<boolean>` — `768px–1023px`. Exposed, not consumed yet.
- `isMobile: Signal<boolean>` — `≤767px`. Exposed, not consumed yet.

Every responsive consumer in this phase reads **`isDesktop()`** and nothing
else (decision D1).

## Implementation notes

**Files:** new `core/layout/breakpoint.ts`.

```ts
@Injectable({ providedIn: 'root' })
export class Breakpoint {
  private readonly observer = inject(BreakpointObserver);
  readonly isDesktop = toSignal(
    this.observer.observe('(min-width: 1024px)').pipe(map(s => s.matches)),
    { initialValue: true },
  );
  readonly isTablet = toSignal(
    this.observer.observe('(min-width: 768px) and (max-width: 1023.98px)').pipe(map(s => s.matches)),
    { initialValue: false },
  );
  readonly isMobile = toSignal(
    this.observer.observe('(max-width: 767.98px)').pipe(map(s => s.matches)),
    { initialValue: false },
  );
}
```

- Import `BreakpointObserver` from `@angular/cdk/layout` (already installed).
- Do not add `LayoutModule` to anything — `BreakpointObserver` is tree-shakable
  and injectable directly.

## Tests first (TDD)

- `breakpoint.spec.ts`: with a fake `BreakpointObserver` whose `observe`
  returns a controllable subject, `isDesktop()` reflects `matches`; default is
  `true` before the first emission; the three signals are independent.
- Provide a reusable test stub (e.g. `provideBreakpointStub(isDesktop = true)`)
  under `testing/` — every later step's specs use it.

## Acceptance criteria

- [ ] `Breakpoint` service with `isDesktop` / `isTablet` / `isMobile` signals.
- [ ] `isDesktop` defaults to `true`.
- [ ] A shared test stub exists for downstream specs.
- [ ] Unit test covers default + reactive updates.

## Out of scope

- Any consumer wiring (later steps).
