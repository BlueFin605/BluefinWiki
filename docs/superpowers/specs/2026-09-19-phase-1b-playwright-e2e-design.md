# Phase 1b Manual Matrix → Playwright E2E (design)

## Context

The Angular parity plan (`docs/flows/angular-parity-plan/`) is 73/73 code-complete, but every phase carries an "OUTSTANDING (not code)" manual browser walkthrough, because jsdom (the frontend's Jest test environment) has no layout engine, no media queries, no paint order, and no `env()` support. Phase 1b's own whole-branch review (`.superpowers/sdd/phase-1b-review.md`) logged a 32-item manual matrix for exactly this reason.

A live session attempting Phase 1b's manual matrix via `claude-in-chrome` browser automation found the matrix's own thesis proven immediately: the tree sidebar and inspector drawer (`frontend/src/app/features/pages/pages-view.ts`) both collapsed to their content's height instead of filling the container, because `.body .sidebar` / `.body .inspector`'s `position: relative` (added only to give a resize-divider a positioning context) had higher specificity than — and silently overrode — Angular Material's own `.mat-drawer { position: absolute; top: 0; bottom: 0; }` full-height rule. The fix (removing the redundant `position: relative`) is already applied in the working tree. The browser-automation tooling itself then became unreliable (extension disconnects, tabs reverting to `chrome://newtab`) mid-walkthrough, which prompted this design: replace the live-driven manual matrix with a repeatable, real-browser automated suite.

## Decision

Build a Playwright Test suite as a pilot covering Phase 1b's 32-item matrix only. If it proves out, later phases' own outstanding manual walkthroughs (2, 5, 6, 7, 8) get the same treatment as separate follow-on work — not part of this spec.

## Architecture

**Package location:** a new top-level `e2e/` directory, sibling to `frontend/` and `backend/` (this repo has no root `package.json`/workspace; each package is `cd`'d into independently). These tests exercise the integrated system (real Angular UI + real backend API), not just the frontend package, so they don't belong inside `frontend/`'s Jest/Angular toolchain.

- `e2e/package.json` — `@playwright/test` as the only real dependency.
- `e2e/playwright.config.ts` — `baseURL: http://localhost:5173`. Assumes the Aspire dev stack (Docker/LocalStack/Cognito-local/MailHog/backend/frontend) is already running, the same way a developer runs it today (`dotnet run --project aspire/BlueFinWiki.AppHost`). No `webServer` auto-start, no CI wiring — local-only for this pilot.
- `e2e/fixtures/` — a `test.extend` fixture that creates a small page tree via the backend's HTTP API in `beforeAll` (a nested hierarchy for tree/breadcrumb-depth checks, one long page with a full H1–H6 heading ladder for TOC checks), every title tagged with a run-scoped prefix (`E2E-<runId>-...`), deleted in `afterAll`. Fully self-contained and repeatable — no reliance on manually-seeded data.
- `e2e/tests/` — one spec file per matrix section (see below).

**Viewport strategy:** the matrix requires exercising breakpoint flips on a *live* window, not just fixed sizes ("resize a live window, not reload" — reload only tests the initial value). Most specs therefore navigate once, assert at 1440×900, then call `page.setViewportSize()` down through 800×1000 and 360×640 (and back up), asserting after each flip — rather than using three fixed Playwright *projects*.

**Real-layout assertions, not screenshots:** every layout claim is checked via `getBoundingClientRect()` / `getComputedStyle()` / `document.elementFromPoint()` against real Chromium layout — e.g. a drawer's `rect.height` genuinely equal to its container's height, or `elementFromPoint(x,y)` at the AI overlay header's coordinates genuinely returning the overlay's own close button rather than the app toolbar underneath it. This is what would have caught today's regression immediately (`rect.height` ≈ 74 instead of ≈ 651).

## Test organization

Mirrors the review's own matrix grouping, so "matrix item N" maps directly to a test:

| Spec file | Matrix items | Notes |
|---|---|---|
| `stacking-paint-order.spec.ts` | 1–6 | Paint-order/occlusion claims via `elementFromPoint` + real `locator.click()` (fails if occluded) — a direct test for the C1-class bug class. |
| `inspector-sheet.spec.ts` | 7–11 | Item 11 (the I2 regression: late async `(closed)` clobbering persisted desktop state) runs with real Material transitions (not `provideNoopAnimations()`), reproducing the actual ~400ms timing window jsdom couldn't. |
| `tree-drawer.spec.ts` | 12–15 | Includes the drawer-height regression test (see Validation below). |
| `editor-toolbar.spec.ts` | 16–22 | Item 18 (horizontal-scroll toolbar row, `overflow-x`/`flex-wrap`) is real-browser-testable despite being logged as "unassertable in jsdom" (roll-up 1b.6-a). |
| `toc-breadcrumbs.spec.ts` | 23–26 | |
| `search-and-global.spec.ts` | 27–32 | Item 32 (orientation rotation) via a `setViewportSize` width/height swap. |

## Coverage gap (accepted)

Item 19's *exact* `env(safe-area-inset-bottom)` device behavior can't be truly simulated by headless Chromium (no real notched-device compositor). The test for this item verifies the CSS contract instead — the bottom reserve references the `env()` variable, and editor content can still scroll clear of a simulated inset — rather than true hardware insets. This matches the project's own prior judgment call on the same rule (roll-up 1b.6-b: "a hand estimate that errs safe"). All other 31 items get a genuine real-browser assertion.

## Validation of the approach itself

The tree/inspector full-height test (`tree-drawer.spec.ts`) will be built test-first: temporarily revert the `position: relative` fix already in the working tree, confirm the test fails (RED) against the reintroduced bug, reapply the fix, confirm it passes (GREEN). This is the concrete proof the suite would have caught what manual QA just caught by chance.

## Replacing the manual requirement

Once the suite is green:
- `docs/flows/angular-parity-plan/phase-1b-responsive/README.md`'s exit criteria updated to reference the `e2e/` spec files (by matrix section) instead of the 32-item manual checklist.
- Parent `docs/flows/angular-parity-plan/README.md` status board updated.
- `.superpowers/sdd/progress.md` (or its Phase 1b archive) gets a note that Phase 1b's outstanding QA is now closed via automation, dated.

Phases 2/5/6/7/8's own "OUTSTANDING (not code)" manual-walkthrough debt is explicitly out of scope here.

## Out of scope

- CI wiring (a follow-up once the pilot proves out — would need LocalStack in a docker-in-docker CI job).
- Extending this pattern to other phases' manual matrices.
- Any change to application code beyond the `position: relative` fix already applied.
