# Step 1.5 — Responsive / mobile layer (F4) — design pass

| | |
|---|---|
| Phase | 1 — Cross-cutting enablers |
| Gap refs | F4; §3.1 mobile top bar / drawer; §3.4 mobile breadcrumb/toolbar; punch list 🔴 #16 |
| Impact | 🔴 Functional |
| Depends on | Phase 0 |
| Est. size | XL — **carved into its own spec** |

## Why this is a separate design pass

The Angular app has **no** mobile layout: `pages-shell` is always a flex row,
the sidebar is a fixed 320 px column, the inspector is a fixed 360 px
`mat-sidenav`. React has a full treatment — `useMediaQuery` breakpoints,
hamburger + slide-in `MobileDrawer`, mobile top bar, bottom-sheet inspector,
editor forced to edit/preview (never split), bottom-pinned toolbar, breadcrumb
collapsing. Porting all of that is a project in itself and it interacts with
several other phases. It should not gate the desktop parity work.

## Deliverable of this step

**Not code.** A design/spec document
`docs/flows/angular-responsive-layer-spec.md` produced via the normal
brainstorming flow, covering at least:

1. **Breakpoint service** — the `lg` / `md` / `sm` thresholds, how components
   subscribe (a `Breakpoint` signal service over `BreakpointObserver`).
2. **Tree drawer** — below `lg`, the page tree becomes a `mat-sidenav` /
   overlay drawer opened by a hamburger in a **mobile top bar**. Desktop
   behaviour unchanged.
3. **Inspector on mobile** — bottom sheet or full-screen, not the fixed side
   panel. Ties to step 4.1.
4. **Editor on mobile** — edit/preview toggle only (no Split, even after
   step 3.1 lands); toolbar pinned to the bottom; heading menu opens upward
   (also the "compact" toolbar variant from step 3.4).
5. **Breadcrumb collapse** — `> 3` segments collapse to
   `Home ▸ … ▸ Current` (ties to step 3.5).
6. **TOC on mobile** — collapsible bar instead of the sticky rail (ties to
   step 3.10).
7. **AI sidebar on mobile** — full-width overlay (currently a pane that
   shrinks content).
8. **Search** — visible search affordance in the mobile top bar (ties to
   step 6.7).
9. Interaction with `Layout` prefs (dividers are desktop-only; drawer state is
   not persisted).

## Process

- Run `superpowers:brainstorming` for this sub-spec.
- Reference the React mobile behaviour in
  [`react-frontend-page-reference.md`](../react-frontend-page-reference.md).
- Once approved, `superpowers:writing-plans` produces
  `docs/flows/angular-parity-plan/phase-1b-responsive/` with its own step files,
  slotted after Phase 1 and before the mobile-specific bullets in Phases 3, 4, 6.

## Acceptance criteria

- [ ] `angular-responsive-layer-spec.md` written, self-reviewed, user-approved.
- [ ] A `phase-1b-responsive/` step breakdown exists.
- [ ] Cross-references added to steps 3.4, 3.5, 3.10, 4.1, 6.7 pointing at the
      relevant sub-step.

## Out of scope (for the eventual sub-spec)

- Dark mode (F3 — permanently out).
- Desktop layout changes beyond what mobile requires.
