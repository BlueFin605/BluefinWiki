# Step 1b.4 — Shell container + tree drawer + hamburger

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md D3, D7, §"Shell — pages-view" |
| Gap refs | §3.1 "Mobile top bar / drawer"; §0.5; F4 |
| Impact | 🔴 Functional |
| Depends on | 1b.1, 1b.3 |
| Est. size | L |

## Problem

`pages-view`'s shell is a static column flex: a toolbar + a `.body` flex-row of
a bare `<aside class="sidebar">` (the tree), `.main` (`<router-outlet>`), and
`.ai-pane`. No sidenav, no drawer, no hamburger. Below 1024 React puts the tree
in a left `MobileDrawer` opened from a hamburger in the top bar.

## Target behaviour

- `pages-view` wraps `.body` in a single `mat-sidenav-container`:
  - **`mat-sidenav start`** = the tree.
    `[mode]="bp.isDesktop() ? 'side' : 'over'"`;
    `[opened]="bp.isDesktop() || treeDrawerOpen()"`;
    `(closedStart)/(closed)` → `treeDrawerOpen.set(false)`;
    desktop width = `layout.treeWidth()` with the `ResizeDivider` (desktop
    only); mobile width = a sensible fixed (e.g. `min(85vw, 320px)`).
  - **`mat-sidenav-content`** hosts `<router-outlet>`.
  - **`mat-sidenav end`** = the inspector (placement here; responsive mode is
    step 1b.5).
- Toolbar: a hamburger `mat-icon-button` shown only when `!bp.isDesktop()`,
  `(click)="treeDrawerOpen.set(true)"`, `aria-label="Open navigation"`.
- Selecting a page (`onPageSelect`) closes the drawer when `!isDesktop()`.
- Backdrop click / `Esc` close the drawer (Material default for `mode="over"`).
- The AI pane: keep the desktop `.ai-pane` flex column; below 1024, render
  `<wiki-ai-sidebar>` as a full-width fixed overlay inside/above
  `mat-sidenav-content` (final AI styling is step 1b.9 — here just make sure the
  desktop pane doesn't force a mobile side-by-side).
- Desktop layout must be visually identical to today (plus the divider from
  step 1.3).

## Implementation notes

**Files:** `features/pages/pages-view.ts` (template + styles + a
`treeDrawerOpen = signal(false)`), inject `Breakpoint`.

- Add `MatSidenavModule` to the component imports.
- The tree `<aside>` styling (border, background, scroll) moves onto the
  `mat-sidenav`.
- Keep `activeGuid` derivation from the URL unchanged.
- `mat-sidenav-container` needs an explicit height (`flex: 1; min-height: 0`) —
  it does not inherit well inside the column flex.

## Tests first (TDD)

- `pages-view.spec.ts` (with the `Breakpoint` stub):
  - `isDesktop = true` → tree sidenav `mode="side"`, always `opened`, no
    hamburger;
  - `isDesktop = false` → `mode="over"`, `opened` follows `treeDrawerOpen`,
    hamburger visible;
  - clicking the hamburger opens the drawer;
  - `onPageSelect` closes the drawer on mobile, leaves it on desktop;
  - flipping `isDesktop` false→true re-opens/pins the tree.

## Acceptance criteria

- [ ] Single `mat-sidenav-container` in `pages-view`; tree is the `start`
      sidenav.
- [ ] Hamburger appears only `<1024` and opens the drawer.
- [ ] Page select closes the mobile drawer; backdrop/Esc close it.
- [ ] Desktop layout unchanged (divider still works).
- [ ] Specs cover both breakpoint states + the transition.

## Out of scope

- Inspector responsive mode (→ 1b.5).
- Final AI overlay + search dialog styling (→ 1b.9).
