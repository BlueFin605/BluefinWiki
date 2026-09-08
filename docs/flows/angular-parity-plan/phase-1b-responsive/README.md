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

- [ ] Every step's acceptance criteria met; `npm test` + `npm run lint` green.
- [ ] Manual at 360×640, 800×1000, 1440×900:
  - [ ] `<1024`: a hamburger opens a left drawer holding the tree; selecting a
        page closes it; backdrop/Esc close it.
  - [ ] `<1024`: the inspector opens as a bottom sheet (≤75vh, full width) from
        an info icon in the editor bar.
  - [ ] `<1024`: the editor offers Edit/Preview only (no Split); the markdown
        toolbar is pinned to the bottom, scrolls horizontally, headings menu
        opens upward, OL/Task/code-block hidden.
  - [ ] `<1024`: breadcrumbs with >3 segments show `Home ▸ … ▸ Current`.
  - [ ] `<1024`: the TOC is a collapsible bar above the preview.
  - [ ] `<1024`: the AI sidebar is a full-width overlay; the search dialog is
        full-screen.
  - [ ] `≥1024`: desktop layout unchanged from post-Phase-4 — tree/inspector
        dividers still resize and persist.
  - [ ] No horizontal body scroll at any width.
- [ ] The global `app.html` toolbar is gone; admin/settings/profile still have a
      back affordance (step 8.1); `/callback` is chrome-less.
- [ ] Parent `README.md` status board + `phase-1-foundations/step-1.5` updated
      to point here.
