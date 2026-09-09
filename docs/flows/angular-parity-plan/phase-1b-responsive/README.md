# Phase 1b — Responsive / mobile layer

**Goal:** give the Angular app the mobile layout it entirely lacks (F4) — a
breakpoint service, a tree drawer + mobile top bar, a bottom-sheet inspector,
mobile editor/toolbar behaviour, breadcrumb collapse, a mobile TOC bar, and
full-width AI / full-screen search.

**Design:** [`DESIGN.md`](DESIGN.md) — read it first. Decisions D1–D8 there are
binding.

**Sequencing:** runs **after Phases 3 and 4** (decision D8) — the inspector
hoist (1b.3) and editor-bar rework (1b.6) refactor `page-detail`, so they land
after Split view (3.1) and the Phase 4 inspector work. The mobile-tagged
acceptance criteria in Phases 3 / 4 / 6 are ticked here.

**Depends on:** Phase 1 (`Layout` clamps + dividers from step 1.3), Phase 3,
Phase 4. Consumes the `compact` inputs added in steps 3.4 and 3.10, and the
`TODO(1.5)` placeholder in step 3.5.

## Steps

| # | Step | Impact | Depends on |
|---|---|---|---|
| 1b.1 | [Breakpoint service](step-1b.1-breakpoint-service.md) | 🔴 | — |
| 1b.2 | [Remove global app toolbar](step-1b.2-remove-global-toolbar.md) | ⚪→do (F12) | — |
| 1b.3 | [PageContext + hoist inspector](step-1b.3-pagecontext-hoist-inspector.md) | 🔴 | 1b.1, Phase 4 |
| 1b.4 | [Shell container + tree drawer + hamburger](step-1b.4-shell-container-tree-drawer.md) | 🔴 | 1b.1, 1b.3 |
| 1b.5 | [Inspector responsive (side ↔ sheet)](step-1b.5-inspector-responsive.md) | 🔴 | 1b.3, 1b.4 |
| 1b.6 | [Editor bar + toolbar responsive](step-1b.6-editor-bar-toolbar-responsive.md) | 🔴 | 1b.1, 3.1, 3.4 |
| 1b.7 | [Breadcrumb mobile collapse](step-1b.7-breadcrumb-mobile-collapse.md) | 🟠 | 1b.1, 3.5 |
| 1b.8 | [TOC mobile bar](step-1b.8-toc-mobile-bar.md) | 🔴 | 1b.1, 3.10 |
| 1b.9 | [AI overlay + search full-screen](step-1b.9-ai-overlay-search-fullscreen.md) | 🟠 | 1b.1 |

**Order:** 1b.1 first. 1b.2 anytime. 1b.3 → then 1b.4 → then 1b.5. 1b.6–1b.9
parallel-safe after 1b.1.

## Phase exit criteria

Code complete at `a886bdb` (9 steps + whole-branch review + fix wave). 92 suites
/ 814 tests green, `npm run lint` + `tsc --noEmit -p tsconfig.app.json` clean.
Ticked items below are jsdom / Testing-Library verified. The **manual matrix is
still owed** — jsdom has no layout engine, so every physical-rendering item
(`[m]` below) needs a real-browser pass; the 32-item checklist is in
`.superpowers/sdd/phase-1b-review.md`.

- [x] Every step's acceptance criteria met; `npm test` + `npm run lint` green
      (whole-branch review passed *with fixes* — 1 Critical (mobile AI overlay
      was painted under the app toolbar) + 3 Important fixed in `a886bdb`).
- [ ] **Manual matrix at 360×640, 800×1000, 1440×900 — OWED:**
  - [x] `<1024`: a hamburger opens a left drawer holding the tree; selecting a
        page closes it; `(closed)` clears the state. *[m] backdrop/Esc gesture.*
  - [x] `<1024`: the inspector `mat-sidenav` is `mode="over"` + `.mobile-sheet`
        (100vw, ≤75vh, bottom-anchored) from an info-labelled editor-bar control.
        *[m] the slide-up animation + backdrop/Esc + ≤75vh scroll.*
  - [x] `<1024`: the editor mode toggle omits Split (live split→edit fallback);
        the compact markdown toolbar has the bottom-pinned class, heading menu
        `yPosition="above"`, headings **H1–H3 only**, OL/Task/code-block hidden.
        *[m] `position:fixed` on a scrolled editor, horizontal scroll,
        `env(safe-area-inset-bottom)`, no obscured content, menu opens upward.*
  - [x] `<1024`: breadcrumbs with >3 segments collapse to `Home ▸ … ▸ Current`,
        driven by `Breakpoint.isDesktop()` (reactive — fixes 3.5-M3). *[m] the
        collapse re-evaluating on resize alone.*
  - [x] `<1024`: the TOC renders as a collapsed "On this page" bar; expand +
        select smooth-scrolls and re-collapses. *[m] the bar sitting above the
        preview via the `@media` stacking; sticky rail unchanged ≥1024.*
  - [x] `<1024`: `<wiki-ai-sidebar>` renders as a `.pages-shell`-level
        `position:fixed` 100vw overlay (`z-index:3`, above `.topbar` — C1 fix);
        the search dialog opens 100vw/100vh with `fullscreen-dialog` panelClass.
        *[m] the overlay actually covering the toolbar; the dialog full-bleed
        with the results list reaching the bottom.*
  - [ ] `≥1024`: desktop layout unchanged from post-Phase-4. *[m] side-by-side
        vs `c8c13b5`: drawer borders/corners, both dividers drag + persist,
        400px AI pane.*
  - [ ] No horizontal body scroll at any width. *[m] esp. 800×1000 where a
        classic scrollbar makes 100vw > container.*
  - [x] Below 1024 the tree drawer, inspector sheet and AI overlay are mutually
        exclusive (DESIGN D9 — I3 fix).
- [x] The global `app.html` toolbar is gone; admin/settings/profile have an
      interim `<h1>` + "Back to pages" + `TODO(8.1)`; `/callback` chrome-less;
      `/403` `/404` standalone.
- [x] Parent `README.md` status board + `phase-1-foundations/step-1.5` point
      here (1.5 already did; status board updated at Phase 1b completion).
