# Phase 1b — Responsive / mobile layer — whole-branch review

**Range:** `c8c13b5..a1c5c20` (15 commits: 9 feature + 6 review-fix)
**Scope:** cross-step / architectural review of the completed phase, on top of the
per-step reviews that each step already passed.
**Method:** read the pre-generated diff package, then the end-state of every touched
file at `a1c5c20` (clean tree), plus `@angular/material` 21.2.11's own sidenav CSS
(`node_modules/@angular/material/fesm2022/sidenav.mjs`) to reason about the
stacking / animation contracts the phase now depends on. Tests were **not** re-run
(92 suites / 805 tests green, lint clean, `tsc` clean per the controller).

---

## Strengths

1. **`Breakpoint` is exactly the seam D1/D2 asked for.**
   `frontend/src/app/core/layout/breakpoint.ts:42-64` — three `toSignal`-wrapped CDK
   queries, `isDesktop` seeded `true` so the app never flashes the mobile layout on
   first paint or under SSR. The complement queries are numerically exact
   (`min-width: 1024px` / `max-width: 1023.98px`), so the one `@media` rule that had
   to be written by hand (`page-detail.ts:404`) cannot drift by a sub-pixel.

2. **`breakpoint.spec.ts`'s `FakeBreakpointObserver` is the right test double.**
   `frontend/src/app/core/layout/breakpoint.spec.ts:132-152` — per-query `Subject`s
   that emit *nothing* until the test says so is what makes
   `breakpoint.spec.ts:166-175` ("defaults before the first emission") a real
   assertion rather than a tautology. Most implementations of this get it wrong by
   seeding a `BehaviorSubject`.

3. **The `provideBreakpointStub` `satisfies` trick is genuinely load-bearing.**
   `frontend/src/app/testing/breakpoint-stub.ts:50-55` — `satisfies Pick<Breakpoint,
   'isDesktop'|'isTablet'|'isMobile'>` means the fake breaks at compile time if the
   real service's consumed surface changes, while the `unknown` hop is confined to
   one line with a comment explaining *why* (the private `observer` field). Eight
   steps consume it and every consumer spec uses it — verified: the only spec file
   matching `PageContext|Breadcrumbs|PagesView|PageDetail` that lacks the stub is
   `page-context-menu.spec.ts`, a false-positive name collision.

4. **`tsconfig.app.json:13` / `tsconfig.spec.json:12`** correctly move
   `src/app/testing/**` out of the app compilation and into the spec one. Easy to
   forget; would otherwise ship the stub in the production bundle graph.

5. **The desktop-parity detail work on the hoisted container is unusually careful.**
   `pages-view.ts:226-231` sets `--mat-sidenav-container-shape: 0` and
   `--mat-sidenav-container-divider-color: #e5e7eb` so the Material drawer reproduces
   the *exact* square corners and `1px #e5e7eb` rules the old static
   `.sidebar` / `.inspector-pane` had (`git show c8c13b5:…/pages-view.ts` confirms
   the old values). `pages-view.ts:233-234` explains why the rules are
   ancestor-qualified (specificity tie with `.mat-drawer` otherwise). This is the
   kind of thing that silently regresses a desktop layout.

6. **The `.mobile-sheet` override is written against Material's actual cascade, not
   guessed.** `pages-view.ts:282-293` — the closed-state transform is guarded
   `:not(.mat-drawer-opened)` precisely because Material's
   `.mat-drawer.mat-drawer-opened.mat-drawer-opened { transform: none }` (0,3,0) must
   still win when open. I verified that rule exists verbatim in the shipped CSS. The
   comment block at `pages-view.ts:268-281` documents the specificity arithmetic.

7. **Signal/effect hygiene is sound; no feedback loops.**
   - `page-context.ts:54-56` — one-directional (`isDesktop → sheet closed`), reads
     `bp.isDesktop()` and writes a *different* signal.
   - `page-detail.ts:683-687` — the split→edit fallback reads and writes
     `_editorMode`, which schedules exactly one re-run that then no-ops. Converges.
   - `table-of-contents.ts:210-213` — `linkedSignal(() => { this.compact(); return
     false; })` is the correct primitive for "reset on breakpoint bounce"; a plain
     `signal` + `effect` would have raced with the template.
   - `table-of-contents.ts:242-266` — the observer is torn down *first*, then
     conditionally rebuilt, and `compact()` is read inside `syncObserver` so
     `afterRenderEffect` re-runs it on a flip. Both directions work.

8. **Test coverage genuinely exercises both flip directions,** which was the main
   risk for a responsive phase:
   `pages-view.spec.ts:541` (mobile→desktop re-pins the tree), `:763`
   (mobile→desktop closes the sheet, no stuck backdrop), `:785`
   (desktop→mobile does *not* surface the side panel as a sheet),
   `breadcrumbs.spec.ts:139` (the 3.5-M3 reactivity fix, asserted *without*
   re-rendering), `table-of-contents.spec.ts:252` (compact→desktop→compact bounce),
   `page-detail.spec.ts:1473` (live split→edit fallback), `:1489` / `:1512`
   (toolbar + TOC `compact` reflect a live flip). These are behavioural, not
   snapshot, assertions.

9. **`page-detail.ts:748-755`** gets the destroy ordering right and says why:
   `stashDraft()` (which reads `pageContext.metadata`) must run *before*
   `pageContext.reset()`. An easy way to silently lose a draft on navigation.

---

## Issues

### Critical (Must Fix)

#### C1 — The mobile AI overlay is painted *underneath* the app toolbar; its header (New chat + Close) is unreachable

**Where:** `frontend/src/app/features/pages/pages-view.ts:316-326` (`.ai-overlay`),
interacting with `:216` (`.topbar { z-index: 2 }`) and `:226` (`.body`, which is now
a `mat-sidenav-container`).

**What's wrong.** `.pages-shell` is a column flex with two children: `.topbar`
(`z-index: 2`) and `.body`. Before this phase `.body` was a plain `div` with no
`z-index`, so a `position: fixed` child could paint over the toolbar. As of 1b.4
`.body` **is** `mat-sidenav-container`, and Material ships
`.mat-drawer-container { position: relative; z-index: 1; }` — verified in
`node_modules/@angular/material/fesm2022/sidenav.mjs:781`. Per the flexbox spec,
`z-index` applies to flex items even when `position: static`, so `.topbar` (2) and
`.body` (1) both create stacking contexts in the root context and the toolbar paints
above everything inside the container.

`.ai-overlay` lives inside `mat-sidenav-content`, i.e. inside
`.mat-drawer-content { position: relative; z-index: 1 }` (same file), inside that
`z-index: 1` container. Its own `z-index: 20` therefore only ranks it against its
*siblings inside the content* — it can never out-rank the toolbar. Since the overlay
is `top: 0; height: 100%` (full viewport), its first ~56–64px — which is
`wiki-ai-sidebar`'s own `mat-toolbar` header carrying **"New chat"** and
**"Close AI assistant"** (`features/ai/ai-sidebar.ts:39-59`) — sits behind the opaque
app toolbar and receives no pointer events.

**Why it matters.** Two controls are lost at the phase's primary breakpoint. The user
can still dismiss the panel via the toolbar's own AI button, so it is not a trap, but
"New chat" is unreachable and the panel visually starts mid-header. It also breaks the
React target directly: `react-frontend-page-reference.md:214-215` puts the AI overlay
at `z-40` and the search modal at `z-50` — i.e. *above* the mobile bar — and D7 says
"full-width fixed overlay **above the content**".

**Why the suite missed it.** `pages-view.spec.ts:866` ("the AI overlay has an in-panel
close control that clears `aiOpen`") passes because jsdom does not paint. The test is
correct about the wiring and wrong about the outcome — exactly the class of false
confidence the manual matrix exists for.

**How to fix (pick one).**
- **Preferred:** hoist the mobile overlay out of `mat-sidenav-content` and render it as
  a direct child of `.pages-shell`, after `.body`, with `z-index: 3`. It is
  `position: fixed` anyway, so it does not need to be inside the container; being a
  sibling of `.topbar` lets it genuinely cover the bar, matching React's `z-40`.
- Or keep it where it is and stop pretending it covers the bar: set
  `top: var(--wiki-topbar-h)` and `height: calc(100% - var(--wiki-topbar-h))`, drop the
  misleading `z-index: 20`, and update the comment. Cheaper, but leaves the app bar
  visible above the AI panel, which is a deliberate divergence worth recording.
- Add a spec that asserts the overlay's DOM ancestry (`not.toBeNull()` on
  `.pages-shell > .ai-overlay`, or `toBeNull()` on `mat-sidenav-content .ai-overlay`),
  since jsdom can assert *structure* even though it cannot assert paint order.

---

### Important (Should Fix)

#### I1 — Compact markdown toolbar still offers H1–H6; React and DESIGN.md both require H1–H3

**Where:** `frontend/src/app/features/editor/markdown-toolbar.ts:184-191` — the
`headings` array is a plain readonly field with all six entries and is *not* filtered
by `compact()`, unlike `listButtons` / `codeButtons` (`:175-177`, `:197-199`).

**What's wrong.** `react-frontend-page-reference.md:336` — "Heading dropdown (H1–H6;
**H1–H3 only in compact/mobile**)". `DESIGN.md:127` repeats it: "`compact` on (hides
OL / Task / code-block; **headings H1–H3**)". The OL/Task/code-block half is
implemented correctly (`COMPACT_HIDDEN` at `:44`); the heading half was never done.

**Why it matters.** This is one of the specific mobile-tagged acceptance criteria from
step 3.4 that Phase 1b is supposed to *tick* (D8: "the mobile-tagged acceptance
criteria in Phases 3/4/6 are ticked here"). Ticking it as-is would record a false
pass. The brief explicitly asked whether the 3.4 / 3.10 `compact` inputs genuinely
hold now — 3.10 (TOC) does; 3.4 is half-done.

**How to fix.** Make `headings` a `computed` that slices to the first three when
`compact()`, mirroring `visible()`. Add a spec beside
`markdown-toolbar.spec.ts:34` ("emits h1..h6 from the heading menu") asserting the
compact menu offers exactly Heading 1–3.

#### I2 — `onInspectorClosed()` can clobber the persisted desktop `inspectorVisible` on a stale, late `(closed)`

**Where:** `frontend/src/app/features/pages/pages-view.ts:396-403`.

**What's wrong.** The guard checks `ctx.guid()` / `ctx.metadata()` **at handler time**,
but `(closed)` is doubly deferred from the state change that caused it:
- `MatDrawer.openedChange = new EventEmitter(true)` — an *async* emitter
  (`sidenav.mjs:184`), so subscribers run in a later task than `emit()`;
- with transitions enabled (the real browser), `openedChange` is only emitted from
  `_animationEnd`, driven by the real `transitionend` / `transitioncancel` events
  (`sidenav.mjs:217-218`, `:376-385`) — i.e. **~400 ms** after `opened` flipped.

On a View↔Edit toggle the router destroys `PageDetail`, whose destroy hook calls
`pageContext.reset()` (`page-detail.ts:754`), nulling `guid`/`metadata`
synchronously. `inspectorOpened()` (`pages-view.ts:354-359`) drops to `false`, the
drawer starts closing, and the replacement `PageDetail` re-publishes `guid` and
rehydrates `metadata` from its page resource. If that round-trip lands *after* the
400 ms close completes but before the async `(closed)` handler runs, the guard passes,
`bp.isDesktop()` is true, and `layout.update({ inspectorVisible: false })` fires —
silently closing and **un-persisting** an inspector the user never touched.

I checked the interrupted-transition path and it is safe: `_animationEnd` emits
`this.opened` *at emission time* (`sidenav.mjs:218`), and `transitioncancel` is
listened to (`sidenav.mjs:215`), so a re-open that interrupts the close emits `true`
and `(closed)` never fires. The residual hole is only the narrow "close completed,
then context repopulated, then the async handler ran" window — but it is a real
window, it widens with a slow page fetch, and it is invisible under
`provideNoopAnimations()` where `_animationEnd` fires immediately.

**Why it matters.** It corrupts persisted user state (`Layout.inspectorVisible` →
localStorage), and the failure is intermittent and timing-dependent — the worst kind
to debug later.

**How to fix (one line, and it subsumes the logged 1b.5-a):**

```ts
onInspectorClosed(): void {
  // A late/stale (closed): the desired state is already "open" again.
  if (this.inspectorOpened()) return;
  if (!this.ctx.guid() || !this.ctx.metadata()) return;
  if (this.bp.isDesktop()) {
    if (this.layout.inspectorVisible()) this.layout.update({ inspectorVisible: false });
  } else {
    this.ctx.inspectorSheetOpen.set(false);
  }
}
```

The `inspectorOpened()` early-return makes the handler idempotent w.r.t. the desired
state; the `if (this.layout.inspectorVisible())` guard removes the redundant
localStorage write logged as **1b.5-a**. Add a spec: with the drawer open on desktop,
null then immediately re-populate `ctx.guid`/`ctx.metadata`, then fire the sidenav's
`closed` output manually — assert `layout.inspectorVisible()` is still `true`.

#### I3 — Nothing arbitrates the three mobile surfaces; two `over` drawers plus the AI overlay can all be open at once

**Where:** `pages-view.ts:365` (`treeDrawerOpen`), `page-context.ts:47`
(`inspectorSheetOpen`), `pages-view.ts:430` (`aiOpen`) — three independent,
uncoordinated signals.

**What's wrong.** Below 1024 the hamburger can be tapped while the inspector bottom
sheet is up, and the AI overlay can be toggled on top of either. `MatDrawerContainer`
happily runs two `over` drawers off one shared backdrop, so the result is a left
drawer *and* a bottom sheet over a single scrim, with the AI overlay under both
(drawers are `z-index: 3` in the container, content is `z-index: 1`). A backdrop tap
does close both drawers at once (`MatDrawerContainer.onBackdropClicked` closes every
open non-`disableClose` drawer), so it is recoverable — but it is not a state React
can reach: `MobileDrawer` instances there are opened from mutually exclusive
affordances.

**Why it matters.** It is the one genuinely new cross-step interaction this phase
creates, and it is currently unspecified — neither DESIGN.md nor any step brief says
what should happen. Left alone it becomes an "it looked weird on my phone" bug report
with no spec to appeal to.

**How to fix.** Cheapest correct thing: make each open path close the others.
`onToggleAi()` and `treeDrawerOpen.set(true)` clear `ctx.inspectorSheetOpen`;
`PageContext.toggleInspector()`'s mobile branch is already reachable from the shell,
so `pages-view` can close the tree drawer alongside it. Alternatively, add one
`computed` "active mobile surface" and derive all three. Either way, record the
decision in DESIGN.md — this is a D-level choice that was never made.

#### I4 — The phase's documentation exit criteria are unmet: no docs changed in the range

**Where:** the review package's own file list — all 36 changed files are under
`frontend/`. Nothing in `docs/` moved.

**What's wrong.** `phase-1b-responsive/README.md:37-58` requires:
- every step's checkboxes ticked;
- "Parent `README.md` status board + `phase-1-foundations/step-1.5` updated to point
  here";
and D8 / the parent `angular-parity-plan/README.md:56` require the mobile-tagged ACs
in Phases 3 / 4 / 6 to be ticked *in this phase*. None of that is in
`c8c13b5..a1c5c20`.

**Why it matters.** The brief was written on the assumption those ticks had landed
("The mobile-tagged acceptance criteria in Phases 3/4/6 are ticked here — check
whether they now genuinely hold"). They have not, which is fortunate given **I1** —
but the phase cannot be marked complete against its own README until the doc pass runs,
and that pass must skip 3.4's heading criterion.

**How to fix.** Do the doc pass as part of the 1b fix wave, after I1 lands. Also fix
the two stale statements in DESIGN.md found below (I5, and the D7 wording in C1).

#### I5 — DESIGN.md claims a Search button that does not exist; below 1024 Search is currently unreachable

**Where:** `DESIGN.md:133` — "Visible Search button | already added in step 6.7; 1b.4
confirms it sits in the mobile top bar | 1b.4".

**What's wrong.** Phase 6 has not run (`angular-parity-plan/README.md:52` still lists
it as a pending phase; `phase-6-search/README.md:25` lists 6.7 as outstanding). I
confirmed there is no Search affordance anywhere: `pages-view.ts:48-88` has hamburger
/ title / spacer / New page / AI / user-menu and no magnifier, and `page-tree.ts`
contains no `search` reference at all. The only entry point is the `Ctrl/Cmd+K`
`@HostListener` at `pages-view.ts:525-536`.

**Why it matters.** At 360×640 there is no keyboard, so **search is entirely
unreachable on mobile today**. It is not a 1b regression — 6.7 owns the button — but
1b.4's job per DESIGN.md was to "confirm it sits in the mobile top bar", and the row
records a confirmation that could not have happened. Left as-is, step 6.7 may add the
button to a sidebar header (React has it in both places,
`react-frontend-page-reference.md:225`) and it would end up buried inside the tree
drawer on mobile.

**How to fix.** Correct the DESIGN.md row to "pending — step 6.7 must place it in the
`pages-view` top toolbar (not the tree header), so it is reachable below 1024", and add
that constraint to `step-6.7-search-visible-button.md`. No code change in 1b.

---

### Minor (Nice to Have)

- **M1 — `PageContext.reset()` leaves `mode` stale.** `page-context.ts:96-100` clears
  `guid`, `metadata` and `inspectorSheetOpen` but not `mode`, so `canInsert()`
  (`:41`) stays `true` after leaving an `/edit` route. Harmless today (the inspector
  is unmounted while `guid` is null and the next mount republishes `mode`), but it is
  the one field of the shared channel that does not follow the documented
  "cleared on destroy" contract. Add `this.mode.set('view')`.

- **M2 — The `.ai-overlay` comment overstates its reach.** `pages-view.ts:313-314`
  says "The z-index clears the sidenav content; the search CDK overlay still layers
  above it." Both clauses are true; the omission is the toolbar (see C1). Whatever
  C1's fix, rewrite the comment to state the full three-way layering, because this is
  the one place a future reader will look.

- **M3 — Double scroll container on the content side.** `pages-view.ts:296-297` makes
  `.body .content` a flex row while Material's `.mat-drawer-content` already carries
  `overflow: auto`, and `.main` adds its own `overflow: auto`. Only `.main` should
  scroll. It works because `.main` is `flex: 1` in a definite-height row, but it is
  one CSS change away from a nested-scrollbar bug. Consider
  `.body .content { overflow: hidden; }`.

- **M4 — No spec asserts `.body.toolbar-pinned` toggles off in the Preview sub-mode.**
  `page-detail.ts:546-548` (`toolbarPinned`) has three conjuncts; the specs cover
  the breakpoint one (`page-detail.spec.ts:1489`) but not `editorMode() !== 'preview'`.
  jsdom *can* assert this one (it is a class on `.body`, not a layout property), so
  it is cheap coverage for a reserve that would otherwise show as unexplained bottom
  padding in Preview.

- **M5 — The `.fullscreen-dialog` panel class does not release Material's dialog
  content cap.** `styles.scss:50-56` sets `max-width` and squares the surface, and the
  `MatDialogConfig` (`pages-view.ts:545-550`) sets `height: 100vh`. Material's
  `.mat-mdc-dialog-content` still carries its own `max-height` token, so the results
  list may stop well short of the bottom with dead space beneath it. Put this on the
  manual checklist; if it bites, add
  `.fullscreen-dialog .mat-mdc-dialog-content { max-height: none; }`.

---

## Minor roll-up triage

| Item | Verdict | Reasoning |
|---|---|---|
| **1b.4-a** module-level mutable `bpStub` in `pages-view.spec.ts` | **TECH-DEBT-OK** (fix opportunistically) | Confirmed at `pages-view.spec.ts:49-52`; the same pattern is also in `breadcrumbs.spec.ts:18,37`. It works only because `[...baseProviders(), ...authProviders()]` evaluates left-to-right before `bpStub.isDesktop.set(...)` — a real but latent ordering dependency. `page-detail.spec.ts:82,94` already shows the right shape (return the stub from the render helper). Low risk, ~10 lines to fix in each file; fold into the 1b fix wave if it is already open, don't schedule work for it alone. |
| **1b.4-b** dead `.hamburger` class | **MUST-FIX-NOW** (trivial) | Confirmed: `pages-view.ts:52` sets `class="hamburger"`, no rule exists in `:214-327`. It is either a forgotten style or a dead hook. Either add the rule (React centres the title, which needs one) or delete the attribute. One line; leaving an unbacked class in a 300-line template is how the next reader loses ten minutes. |
| **1b.4-c** no test for `(closed)` resetting `treeDrawerOpen` | **DISPUTED — partially testable** | The *backdrop/Esc gesture* is indeed jsdom-hostile, but the `(closed)` **binding** is not: the tree sidenav is reachable via `By.directive(MatSidenav)` (the spec already does exactly this at `pages-view.spec.ts:446-454`), so a test can call `treeSidenav(fixture).close()` and assert `treeDrawerOpen()` is `false`. The equivalent inspector test already exists (`pages-view.spec.ts:748`, "mobile: the sidenav (closed) output clears inspectorSheetOpen"), so the asymmetry is an omission, not a limitation. Add the mirror test; keep the *gesture* on the manual matrix. |
| **1b.5-a** redundant `inspectorVisible: false` write | **MUST-FIX-NOW** — but as part of **I2** | On its own it is a harmless duplicate localStorage write. It stops being cosmetic once you see it shares a root cause with I2: `onInspectorClosed` acts on the event instead of reconciling against the desired state. The I2 patch above fixes both in the same three lines. |
| **1b.5-b** `.mobile-sheet` has `border-radius: 0`, no grab handle | **TECH-DEBT-OK** | `pages-view.ts:289` — deliberate and commented. React's `MobileDrawer` (`react-frontend-page-reference.md:113`) is specified only as `side="bottom"`, 75vh; rounded corners and a handle are not in the parity target. Cosmetic polish, not a gap. |
| **1b.6-a** compact toolbar tests are class-presence only | **TECH-DEBT-OK** | `markdown-toolbar.spec.ts:87-95` asserts the `bottom-pinned` host class, which is the correct jsdom-side contract; `overflow-x` / `flex-wrap` are genuinely unassertable there (no layout engine, and the values live in a component stylesheet jsdom does not cascade). The right compensating control is the manual checklist, which now carries them. No action. |
| **1b.6-b** the `56px` reserve is a hand estimate | **TECH-DEBT-OK — and it errs safe** | `page-detail.ts:388` reserves `calc(56px + env(safe-area-inset-bottom))`. Measured against the actual box: M3 `mat-icon-button` is 40px, `.toolbar` adds `padding: 4px` top and bottom (`markdown-toolbar.ts:131`) and `border-top: 1px` in the pinned variant (`:159`) → ~49px. So it **over**-reserves by ~7px, which is the harmless direction (a small gap, never clipped content), and `env(safe-area-inset-bottom)` is correctly added on both sides. The cross-referencing comments (`page-detail.ts:381-387` ↔ `markdown-toolbar.ts:133-141`) are the right mitigation short of a ResizeObserver, which would be over-engineering. |
| **1b.8-a** 1024 has two sources of truth | **TECH-DEBT-OK — but make it one token** | Confirmed: `page-detail.ts:404` (`@media (max-width: 1023.98px)`) vs `!bp.isDesktop()` at `:245`, `:327`, `:342`. Unavoidable in kind — you cannot drive `flex-direction` from a signal without a class binding, and the queries *are* exact complements. Cheap hardening: bind a `[class.stacked-toc]="!bp.isDesktop()"` on `.container` and key the stacking rules off that class instead of the `@media`, collapsing it to one source. Worth doing when the file is next open; not blocking. |
| **1b.8-b** compact TOC bar has no caret/chevron | **TECH-DEBT-OK** | `table-of-contents.ts:61-68` — `aria-expanded` carries the state for assistive tech, which is the correctness bar. A chevron is affordance polish; React's reference (`:390-393`) specifies only "a collapsible 'On this page' bar". |
| **1b.2-a** six duplicated back-link blocks | **TECH-DEBT-OK** | Explicitly sanctioned interim; every one carries `TODO(8.1)` (verified in `invitation-management.ts:335`, `profile-page.ts:16`, and the four siblings) and step 8.1 replaces all six with a shared header. Abstracting now would create a component that 8.1 immediately deletes. Correct call. |

**Net:** two of the eleven logged Minors are MUST-FIX-NOW (1b.4-b, 1b.5-a — the
latter folded into I2), one is DISPUTED as more testable than recorded (1b.4-c), and
the rest are correctly classified as debt.

---

## `PageContext` as an architecture

**Verdict: the right seam, and it has held up under five more steps. Two lifecycle
notes, neither blocking.**

D3 forced the inspector and the editor into different components; something has to
join them, and the options were a root service, an input/output chain through
`RouterOutlet` (impossible — `pages-view` cannot template-bind into a routed child),
or an injected parent reference (couples `page-detail` to `pages-view`). A root
service is correct.

The split of responsibilities is the part that ages well:

- **Shared state as a shared `WritableSignal`, not a copy.** `page-detail.ts:467`
  (`readonly metadata = this.pageContext.metadata`) means the inspector's
  `metadataChange` and `page-detail`'s dirty-detection read and write literally the
  same cell. There is no second copy to desynchronise — which is exactly what D4's
  "no second copy of inspector state to keep in sync" asked for, applied one level
  deeper than D4 required.
- **Events as `Subject`s, state as signals.** `insert$` / `titleH1Sync$` /
  `pageTypeChange$` are genuinely event-shaped (an insert must fire twice for two
  identical inserts; a signal would deduplicate). `page-detail.ts:623-631` subscribes
  with `takeUntilDestroyed()` in the constructor, so the subscriptions die with the
  component. Correct primitive for each.
- **Ownership of the responsive branch is in one place.** `toggleInspector()`
  (`page-context.ts:87-93`) is the only code that decides desktop-persisted vs
  mobile-ephemeral. `page-detail`'s button (`:196-203`) and `pages-view`'s
  `inspectorOpened()` both defer to it. Good.

**Lifecycle holes considered:**

1. **Two `PageDetail` instances during a route transition — not reachable.** Angular's
   `ActivateRoutes` deactivates before it activates, so `reset()` always precedes the
   replacement's first effect. The `guid`-null window this creates is exactly what
   `onInspectorClosed`'s guard exists for — see **I2** for the one case where that
   guard is not enough.

2. **Lost emissions during the destroy→create window — theoretically possible, not
   reachable in practice.** The Subjects are hot with no replay, so an emission with
   no subscriber is dropped. But the only emitter is `wiki-inspector-panel`, which is
   `@if`-gated on `ctx.guid() && ctx.metadata()` (`pages-view.ts:182`) — the same
   condition that is false for the whole window. Nothing can emit while nothing is
   listening. Worth keeping in the docstring if anyone ever adds a second emitter.

3. **`reset()` timing is right, `reset()` completeness is not quite** — see **M1**
   (`mode` is not cleared).

4. **The stale-metadata window on a param-only nav** (`/pages/g1` → `/pages/g2`,
   where `PageDetail` is reused so `reset()` never runs) is real: `ctx.guid()` flips
   before `ctx.metadata()` rehydrates, so `InspectorPanel` briefly has g2's `pageGuid`
   with g1's `metadata` — the attachments tab would refetch for g2 while Properties
   still shows g1's title. It is **correctly identified and documented in place** at
   `pages-view.ts:161-169`, and it is genuinely pre-existing (the identical
   `@if (guid() && metadata(); as m)` guard sat in `page-detail` at `c8c13b5`). No
   action for 1b; it belongs on a Phase 2/3 navigation-polish list.

---

## Phase 4 I2 + I8 recommendation

**Recommendation: own micro-step (a Phase 4 follow-up, e.g. `4.10`), not folded into
the 1b fix wave.**

**Reasoning.**

- **The 1b.3/1b.5 restructure did not change what either fix needs.** The Phase 4
  review deferred them "until after 1b.5" on the theory that the inspector hoist
  might reshape them. It did not. `attachment-manager.ts` is untouched by this
  range (its `Loading attachments…` at `:91` and the `retry`/`nextDelay` backoff at
  `:243-249` are byte-identical), and `inspector-panel.ts` lost only the dead
  `presentation` seam (9 lines) — the destroying `@if (selectedTab() === 0)` pattern
  at `:37`, `:53`, `:81` and both resources at `:126`/`:135` are exactly as Phase 4
  left them. The premise for deferral has expired; the work is now cleanly separable.
- **Different files, different test surfaces, different reviewers' concerns.** Nothing
  in I2 or I8 touches `pages-view`, `page-context`, `page-detail`, `breakpoint` or any
  responsive CSS. Merging them into the 1b fix wave would mix a layout/stacking fix
  wave (C1, I2, I3) with an inspector-internals data-fetching fix wave, making both
  harder to review and to revert.
- **1b's fix wave is already load-bearing.** C1 changes the shell's DOM structure and
  I3 changes mobile surface arbitration. Keep that wave focused.

**Two 1b-created facts the `4.10` brief must carry:**

1. **Below 1024 the inspector panel is instantiated on every page load, before the
   sheet is ever opened.** `pages-view.ts:182` gates the panel on
   `ctx.guid() && ctx.metadata()` — *not* on `opened` — and Material keeps a closed
   drawer's content in the DOM (it merely sets
   `.mat-drawer-inner-container { display: none }`, `sidenav.mjs:781`). So
   `PagePropertiesPanel` + `CustomPropertiesEditor` + their page-types / page-tags /
   multi-vocab `rxResource`s all construct and fetch for an invisible bottom sheet on
   every mobile page open. **This is not a 1b regression** — `c8c13b5`'s
   `page-detail.ts:353` had the identical guard inside its own `mat-sidenav` — but it
   makes I8's cost *more* visible on mobile, where the network is worst and the panel
   is least often opened. It also tilts the choice among I8's three options: the
   `*matTabContent` lazy-once route only defers *within* the panel, so pair it with
   gating the panel itself on `inspectorOpened()` (or hoisting the resources so they
   are shared and can be made lazy). Worth stating explicitly so `4.10` does not
   solve half the problem.

2. **I2's status text now renders inside a ≤75vh bottom sheet on mobile**
   (`pages-view.ts:282-290`). Keep it to a single line that reads sensibly in a
   narrow, height-capped surface — "Loading attachments… (retry 3 of 10)" rather
   than a multi-line block. React's requirement is just "with status text"
   (`react-frontend-page-reference.md:414`).

**Sequencing:** `4.10` is independent of the 1b fix wave and can run in parallel.
Neither blocks accepting Phase 1b.

---

## Manual matrix checklist

Everything below is **unverified by the 805-test suite** because jsdom has no layout
engine, no media queries, no paint order and no `env()` support. Run at
**360×640**, **800×1000** and **1440×900**, and exercise each flip in **both**
directions (do it by resizing a live window, not by reloading at a new size — the
reload path only tests the initial value, not the flip effects).

**Stacking / paint order (highest risk — this is where C1 lives)**
1. Mobile, AI overlay open: is `wiki-ai-sidebar`'s header ("AI assistant", New chat,
   Close) **visible and clickable**, or hidden behind the app toolbar? *(C1 predicts
   hidden. Confirm before/after the fix.)*
2. Mobile, AI overlay open: does it cover the full width with **no content squeeze**
   of `.main` behind it (the `position: fixed` + `100vw` claim at
   `pages-view.ts:316-321`)?
3. Mobile, inspector sheet open **over** the pinned markdown toolbar: does the sheet
   (and its backdrop) paint above the toolbar, per `markdown-toolbar.ts:147-150`?
4. Mobile: open the tree drawer **while** the inspector sheet is open. What is on
   screen? Does one backdrop tap close both? *(I3 — record the actual behaviour.)*
5. Mobile: open the AI overlay, then the tree drawer. Which wins? *(Predicted: the
   drawer, `z-index: 3` vs content's `z-index: 1`.)*
6. Search dialog (`Cmd/Ctrl+K` on a tablet-width window with a keyboard) opens
   **above everything** including the AI overlay — the CDK overlay container is
   outside `.pages-shell`, so this should hold; confirm.

**Inspector bottom sheet (1b.5)**
7. `<1024`: the info button in the editor bar opens the sheet, and it **slides up from
   the bottom edge**, not in from the right (the `translateY(100%)` override at
   `pages-view.ts:291-293`).
8. Sheet is full-bleed **100vw**, capped at **75vh**, pinned to the bottom, and its
   own content scrolls inside that cap when Properties is long.
9. Backdrop tap **and** `Esc` both dismiss it.
10. Desktop→mobile flip with the desktop inspector open: it must **not** appear as a
    sheet, and no orphaned backdrop is left behind.
11. Mobile→desktop flip with the sheet open: it must close cleanly and the desktop
    panel's persisted visibility must be **unchanged** (this is I2's blast radius —
    toggle View↔Edit a few times fast on desktop with the inspector open and confirm
    it stays open and stays persisted after a reload).

**Tree drawer (1b.4)**
12. Hamburger appears only `<1024`, opens the left drawer; drawer is `min(85vw,320px)`.
13. Selecting a page closes it; backdrop tap and `Esc` close it.
14. Mobile→desktop flip: the tree re-pins as a `side` drawer with **no backdrop**.
15. `.hamburger` — is the mobile title centred as React specifies
    (`react-frontend-page-reference.md:218`)? *(Roll-up 1b.4-b: there is no rule for
    the class today.)*

**Editor bar + markdown toolbar (1b.6)**
16. `<1024`: the mode toggle offers **Edit | Preview** only; a live desktop→mobile flip
    while in Split snaps to Edit **without a flash of a broken two-pane layout**.
17. The toolbar is genuinely `position: fixed` at the bottom on a **scrolled** editor
    (this is the claim `position: sticky` would have failed —
    `markdown-toolbar.ts:133-141`).
18. The toolbar row **scrolls horizontally** and does not wrap (`overflow-x: auto` /
    `flex-wrap: nowrap` — unassertable in jsdom, roll-up 1b.6-a).
19. On a device with a home indicator (or emulated safe-area insets): the toolbar
    clears it, **and** the last line of the editor can be scrolled clear of the
    toolbar — i.e. `env(safe-area-inset-bottom)` is applied on **both** the toolbar
    padding and `.body`'s reserve (`page-detail.ts:388`). Check with a document that
    ends exactly at the fold.
20. The heading menu opens **upward** and is fully on-screen above the pinned bar.
21. In the **Preview** sub-mode the bottom reserve is **released** (no phantom gap at
    the bottom) — the toolbar is not rendered there (see M4).
22. **After the I1 fix:** the compact heading menu offers **Heading 1–3 only**.

**TOC (1b.8) and breadcrumbs (1b.7)**
23. `<1024`: the TOC is a **full-width collapsed bar above** the content, not a right
    rail — this exercises the `@media` half of the duplicated 1024 threshold
    (`page-detail.ts:404-416`), which no test covers.
24. Expanding, picking an entry: it smooth-scrolls **and** the bar re-collapses.
25. `≥1024`: the rail is back, `position: sticky` still works while the preview
    scrolls, and the active-heading highlight tracks (the `IntersectionObserver` is
    torn down in compact and must be re-wired on the flip back —
    `table-of-contents.ts:242-266`).
26. `<1024` with a deep page: breadcrumbs render `Home / … / Current`; at `≥1024` the
    full trail returns **on resize alone**, no reload.

**Search + desktop parity + global**
27. `<1024`: the search dialog is **truly full-bleed** — 100vw × 100vh, square corners,
    and the **results list reaches the bottom of the screen** with no dead band (M5).
28. `≥1024`: the search dialog is the 640px centred card, unchanged.
29. **Desktop parity vs `master`/`c8c13b5`, side by side at 1440×900:** tree and
    inspector borders (1px `#e5e7eb`), **square** corners on both drawers, both resize
    dividers drag and **persist across a reload**, the AI pane is still a 400px column
    to the right of the content. D3's hoist must be visually invisible on desktop.
30. **No horizontal body scroll at any of the three widths**, in view mode, edit mode,
    with the AI overlay open, and with the inspector sheet open. Specifically check
    800×1000, where a classic scrollbar makes `100vw` wider than the container
    (`pages-view.ts:284`, `:319`).
31. `/settings`, `/admin/*`, `/profile`: the global toolbar is gone and each still has
    a working "Back to pages" link and an `<h1>` (D5). `/callback` is chrome-less.
    `/403` and `/404` still offer their own way out.
32. Rotate a phone 360×640 ↔ 640×360 with the inspector sheet open, the tree drawer
    open, and the AI overlay open — each should survive the orientation change without
    a stuck backdrop or a scroll lock.

---

## D1–D8 compliance

| # | Verdict |
|---|---|
| **D1** — binary 1024 breakpoint | **Honoured.** One `isDesktop` switch drives every decision; `isTablet`/`isMobile` are exposed and provably unconsumed. The single hand-written `@media` (`page-detail.ts:404`) is the exact complement. |
| **D2** — CDK `BreakpointObserver` | **Honoured.** `breakpoint.ts:44-64`; no hand-rolled `matchMedia` survives anywhere — the `window.matchMedia` in breadcrumbs (Phase 3 finding 3.5-M3) was removed by 1b.7 and replaced with `bp.isDesktop()` (`breadcrumbs.ts:84-87`). |
| **D3** — single hoisted `mat-sidenav-container` in `pages-view` | **Honoured.** `pages-view.ts:95-202`; `page-detail` no longer owns a container (`c8c13b5:page-detail.ts:343` had one, `a1c5c20` has none). No nesting. |
| **D4** — inspector = one reactive `mat-sidenav`, not `MatBottomSheet` | **Honoured, and well.** `pages-view.ts:171-201` — one mount path, one `[opened]`, pure-CSS mode switch. No `MatBottomSheet` import anywhere. The dead `InspectorPanel.presentation` seam was removed rather than left as a decoy. |
| **D5** — remove the global `app.html` toolbar | **Honoured.** `app.html` is `<router-outlet />`; `app.ts` dropped `MatToolbarModule`/`RouterLink`; all six interim back-links carry `TODO(8.1)`; `app.spec.ts` asserts the absence rather than just not asserting the presence. |
| **D6** — drawer state ephemeral, dividers desktop-only | **Honoured.** `treeDrawerOpen` (`pages-view.ts:365`) and `inspectorSheetOpen` (`page-context.ts:47`) are plain signals, never persisted; both dividers are `@if (bp.isDesktop())`-gated (`pages-view.ts:115`, `:196`) and asserted by `pages-view.spec.ts:529`. |
| **D7** — AI = fixed overlay, not a third sidenav | **Drifted (mechanism honoured, outcome not).** It is correctly a `position: fixed` overlay and *not* a third sidenav, so the letter of D7 holds. But "above the content" fails in the one way that matters: nesting it inside the now-`z-index: 1` `mat-sidenav-container` puts it below the `z-index: 2` toolbar, so it does not layer like React's `z-40`. See **C1**. |
| **D8** — sequencing after Phases 3 and 4 | **Honoured for execution, incomplete for bookkeeping.** The ordering was followed and `page-detail` was reworked exactly once. But the half of D8 that says "the mobile-tagged acceptance criteria in Phases 3/4/6 are ticked here" has not been done (**I4**) — and must not be done for 3.4's heading criterion until **I1** lands. |

---

## Recommendations

1. **Fix C1 before accepting.** Prefer hoisting `.ai-overlay` to a direct child of
   `.pages-shell` with `z-index: 3` — it restores React's `z-40` semantics and removes
   the dependency on Material's internal `z-index: 1` staying at 1. Add a
   DOM-ancestry spec so the regression is caught in jsdom next time.
2. **Fix I1** (compact headings H1–H3) — it is four lines and it is the difference
   between ticking step 3.4's mobile AC honestly and dishonestly.
3. **Apply the I2 patch**, which also closes roll-up 1b.5-a. Reconciling against
   `inspectorOpened()` rather than reacting to the event is the structurally right
   shape for a late async output, and it is cheaper than any alternative.
4. **Decide I3 and write it into DESIGN.md** as a D9. Even "any two may be open, the
   backdrop closes both" is an acceptable answer — what is not acceptable is having no
   answer for the one genuinely new cross-step interaction the phase creates.
5. **Then run the doc pass (I4)** — step checkboxes, the parent status board,
   `phase-1-foundations/step-1.5`, and the Phase 3/4/6 mobile ACs — and correct the two
   stale DESIGN.md rows (the Search-button claim in **I5**, and D7's wording once C1
   is settled).
6. **Then run the manual matrix.** Items 1, 4, 17, 19, 23, 27 and 30 are the ones most
   likely to surface something new; the rest are confirmations.
7. **Schedule `4.10` for I2 + I8** with the two carry-over notes above. Not blocking.
8. Opportunistically, while the files are open: 1b.4-b (dead `.hamburger`), 1b.4-c
   (the `(closed)` mirror test, which *is* writable), M1 (`reset()` should clear
   `mode`), M4 (the Preview-reserve test), and the `bpStub` handle in
   `pages-view.spec.ts` / `breadcrumbs.spec.ts`.

---

## Assessment

**Ready to accept this phase?** **With fixes**

**Reasoning:** The architecture is right and the execution is careful — `PageContext`
is the correct seam and has held under five dependent steps, D1–D6 and D8's execution
half are cleanly honoured, the effect/signal work handles both flip directions with no
loops or missed cleanup, and the ~60 net-new tests assert real behaviour rather than
structure. But three things must land before acceptance: the mobile AI overlay is
painted under the toolbar so its close/new-chat controls are unreachable (**C1**, a D7
outcome drift created by 1b.4's container hoist), the compact markdown toolbar never
implemented the H1–H3 heading restriction that D8 requires this phase to tick
(**I1**), and `onInspectorClosed()` can clobber persisted desktop state on a late
async `(closed)` (**I2**). None is architectural; all three are small, local and
well-understood. The documentation exit criteria (**I4**) are also entirely
outstanding — no docs changed in the range — and the manual matrix still owes the
entire visual verification of the phase.

---

## Closing note (2026-09-19 to 2026-09-20)

The "manual matrix still owes the entire visual verification of the phase" line above is resolved by an automated Playwright suite instead of a human walkthrough — see `docs/superpowers/specs/2026-09-19-phase-1b-playwright-e2e-design.md` (design) and `docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md` (implementation). 34 tests across `e2e/tests/{smoke,fixtures,stacking-paint-order,inspector-sheet,tree-drawer,editor-toolbar,toc-breadcrumbs,search-and-global}.spec.ts` cover all 32 matrix items, all passing. 31 of the 32 get a genuine real-browser assertion; item 19's exact `env(safe-area-inset-bottom)` device behavior is checked at the CSS-contract level only (headless Chromium has no real notched-device compositor), consistent with this review's own prior judgment on the same rule (roll-up 1b.6-b).

The suite's flagship test (`tree-drawer.spec.ts`, "item 12/29") was built test-first against the exact `position: relative` drawer-height regression a live manual-walkthrough attempt found earlier in this same effort — confirmed RED against the reintroduced bug, then GREEN against the fix — proving the automated approach would have caught it. Building the remaining coverage then found **three more previously-unknown, real product bugs**, none caught by the 1200+ existing jsdom unit tests, each the same class of defect this manual matrix existed to catch:

- **Mobile hamburger unreachable behind the AI overlay.** Below 1024px, once the AI overlay is open, `.ai-overlay`'s z-index (raised above `.topbar` by this same phase's own C1 fix) also covered the hamburger, with no keyboard alternative — D9/I3's "opening the drawer closes the AI overlay" direction had no reachable trigger for any real user. A first fix attempt (a plain z-index bump on the button) was itself wrong — a flex item's own z-index traps descendant z-index inside its stacking context — caught empirically via `elementFromPoint` before being corrected with a hoisted sibling button (the same technique C1 used for the overlay itself).
- **Mobile editor mode-toggle crushed invisible.** At phone widths, the editor header's non-title content already exceeded the viewport even with a zero-width title; the Edit/Split/Preview toggle's own `overflow: hidden` stripped its flexbox minimum-size protection while every sibling had one, so the flex algorithm crushed the toggle to ~0px and unclickable instead of shrinking anything else. Fixed with `flex-wrap` instead of removing or hiding any control.
- **Desktop search dialog rendering 80px narrower than documented.** `openSearch()`'s desktop branch asked for `width: '640px'` but never paired it with `maxWidth`, so Angular Material's own M3 dialog theme default (`max-width: 560px`) silently won — the mobile branch two lines below had already learned to pair the two. Rendering at 560px instead of the documented, coded 640px, until this suite measured the actual box.

Each was found by treating an unexpected test failure as a signal to investigate against real component source rather than dev-server flakiness — the same discipline the manual matrix itself was meant to enforce. All four are fixed and covered by regression tests going forward.
