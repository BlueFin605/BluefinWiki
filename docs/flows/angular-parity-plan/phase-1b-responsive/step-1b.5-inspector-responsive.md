# Step 1b.5 — Inspector responsive (side ↔ bottom sheet)

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md D4, §"Per-surface behaviour" |
| Gap refs | §3.4 "Inspector panel — Panel placement"; §0.5; F4; F5 |
| Impact | 🔴 Functional |
| Depends on | 1b.3, 1b.4; step 4.1 |
| Est. size | M |

## Problem

The inspector `mat-sidenav` (now the `end` sidenav in `pages-view`, per steps
1b.3/1b.4) is still a fixed side panel. React: desktop right resizable panel
bound to `inspectorWidth` / `inspectorVisible`; **mobile bottom-sheet**
(`side="bottom"`, 75vh).

## Target behaviour

- **Desktop (`isDesktop()`):**
  `mode="side"`, `[opened]="layout.inspectorVisible()"`,
  `[style.width.px]="layout.inspectorWidth()"`, `ResizeDivider` active
  (from step 1.3). Toggling writes `layout.update({ inspectorVisible })`.
- **Mobile (`!isDesktop()`):**
  `mode="over"`, `[opened]="ctx.inspectorSheetOpen()"`, class `mobile-sheet`:
  `width: 100vw; max-width: 100vw; max-height: 75vh;` anchored to the **bottom**
  edge. Backdrop + `Esc` close it (and clear `inspectorSheetOpen`).
  No divider.
- The editor-bar inspector control (in `page-detail`, calls
  `PageContext.toggleInspector()`): on mobile it is an **info icon** opening the
  sheet; on desktop the existing toggle.
- Flipping the breakpoint while the sheet is open closes it and falls back to
  the desktop `inspectorVisible` state (and vice-versa) — no stuck backdrop.

## Implementation notes

**Files:** `features/pages/pages-view.ts` (the `end` sidenav bindings + the
`.mobile-sheet` CSS), `features/pages/page-context.ts` (`inspectorSheetOpen` +
`toggleInspector` branching — mostly from 1b.3), `features/pages/page-detail.ts`
(the bar control's icon/label per `Breakpoint`),
`features/editor/inspector-panel.ts` (only if internal padding/scroll needs a
mobile tweak).

- Material's `position="end"` sidenav slides from the right. For the
  bottom-sheet look, override with CSS: pin the panel to
  `bottom: 0; top: auto; height: auto;` and let the enter animation come from
  the bottom (`transform: translateY(100%)` → `0`). Confirm the backdrop still
  covers the viewport. If Material's transform fights this hard, fall back to a
  dedicated bottom-anchored `cdkOverlay` for the mobile case — but try the CSS
  override first (keeps one mount path per D4).
- `(closed)` on the sidenav → clear whichever open-state applies.

## Tests first (TDD)

- `pages-view.spec.ts` (Breakpoint stub):
  - desktop → inspector `mode="side"`, `opened` = `layout.inspectorVisible()`,
    width = `inspectorWidth()`;
  - mobile → `mode="over"`, `opened` = `ctx.inspectorSheetOpen()`, has
    `mobile-sheet` class;
  - toggling on desktop calls `layout.update`; on mobile flips the sheet
    signal;
  - breakpoint flip with the sheet open closes it cleanly.
- `page-detail.spec.ts`: the bar control renders an info icon on mobile, the
  toggle on desktop; both call `PageContext.toggleInspector()`.

## Acceptance criteria

- [ ] Desktop inspector = side panel bound to `Layout` + divider.
- [ ] Mobile inspector = bottom sheet ≤75vh, full width, backdrop/Esc close.
- [ ] Editor-bar control adapts (info icon on mobile).
- [ ] Breakpoint flips don't leave a stuck backdrop or wrong open-state.
- [ ] Specs cover both modes + the flip.

## Out of scope

- Inspector tab contents (Phase 4).
