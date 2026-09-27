# Step 1.5 — Responsive / mobile layer (F4) — see Phase 1b

| | |
|---|---|
| Phase | 1 — Cross-cutting enablers |
| Gap refs | F4; §3.1 mobile top bar / drawer; §3.4 mobile breadcrumb/toolbar; punch list 🔴 #16 |
| Impact | 🔴 Functional |
| Status | **Designed** — broken out into [`../phase-1b-responsive/`](../phase-1b-responsive/README.md) |

## Why this is a separate phase

The Angular app has **no** mobile layout: the shell is always a flex row, the
sidebar a fixed 320 px column, the inspector a fixed 360 px `mat-sidenav`.
React has a full treatment (breakpoints, hamburger drawer, mobile top bar,
bottom-sheet inspector, edit/preview-only editor, bottom-pinned toolbar,
breadcrumb collapse). Porting it is a project in itself and it refactors
`page-detail` and `pages-view`, so it must not gate the desktop parity work.

## Resolution

- **Design:** [`../phase-1b-responsive/DESIGN.md`](../phase-1b-responsive/DESIGN.md)
  — approved. Decisions: binary breakpoint at 1024px; CDK `BreakpointObserver`
  signal service; single hoisted `mat-sidenav-container` in `pages-view` (a new
  `PageContext` service carries the inspector up from `page-detail`); reactive
  `mat-sidenav` for the inspector (side ↔ bottom-sheet); the global `app.html`
  toolbar is removed.
- **Steps:** [`../phase-1b-responsive/`](../phase-1b-responsive/README.md) —
  README + 9 step files (1b.1–1b.9).
- **Sequencing:** Phase 1b runs **after Phases 3 and 4** (not right after
  Phase 1). The mobile-tagged acceptance criteria in Phases 3 / 4 / 6 are
  ticked in Phase 1b. See DESIGN.md decision D8.

## Cross-references into Phase 1b

| This plan step | Phase 1b owner |
|---|---|
| 3.4 (toolbar `compact` input) | 1b.6 |
| 3.5 (`TODO(1.5)` breadcrumb gate) | 1b.7 |
| 3.10 (TOC `compact` input) | 1b.8 |
| 4.1 (inspector ↔ `Layout` binding, mobile sheet) | 1b.3, 1b.5 |
| 6.7 (search button in the mobile top bar) | 1b.4 |

## Out of scope (Phase 1b)

- Dark mode (F3 — permanently out).
- Desktop layout changes beyond what the inspector hoist mechanically requires.
