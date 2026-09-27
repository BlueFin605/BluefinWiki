# Step 1b.9 — AI overlay + search dialog full-screen

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md D7, §"Per-surface behaviour" |
| Gap refs | §3.1 "AI sidebar" (full-width on mobile), §3.6 "Layout … full-screen on mobile"; §0.5 |
| Impact | 🟠 |
| Depends on | 1b.1 |
| Est. size | S |

## Problem

- **AI sidebar:** `pages-view` renders it as a 400px flex `.ai-pane` that
  shrinks the content area. React: fixed right overlay `w-96`, **full-width on
  mobile**, `z-40`.
- **Search dialog:** opened at a fixed 640px `MatDialog`. React: centered modal
  on desktop, **full-screen on mobile**.

## Target behaviour

- **AI (`<1024`):** render `<wiki-ai-sidebar>` as a `position: fixed` overlay
  covering the viewport width (100vw), above `mat-sidenav-content`, with its own
  close control; no content-area squeeze. Desktop keeps the `.ai-pane` flex
  column (or an `w-96` right overlay — keep the current pane on desktop to
  minimise churn).
- **Search dialog (`<1024`):** open `MatDialog` with a full-screen panel class
  (`panelClass: 'fullscreen-dialog'`, `maxWidth: '100vw'`, `width: '100vw'`,
  `height: '100vh'`); desktop keeps 640px centered. Decide the width at open
  time from `Breakpoint.isDesktop()`.

## Implementation notes

**Files:** `features/pages/pages-view.ts` (AI overlay class / structure),
`features/ai/ai-sidebar.ts` (only if it needs a mobile close affordance it
lacks), wherever the search dialog is opened (`pages-view` `openSearch()` /
the `Ctrl+K` handler) — pass responsive `MatDialogConfig`;
a `fullscreen-dialog` style in the global stylesheet or the component.

- The AI overlay `z-index` must sit above the Material sidenav content but the
  search dialog (CDK overlay) will still layer above it — fine.

## Tests first (TDD)

- `pages-view.spec.ts` (Breakpoint stub): mobile + `aiOpen` → the AI host has
  the full-width overlay class, not the `.ai-pane` layout; desktop → `.ai-pane`.
- Search open: `openSearch()` passes `width/height: 100vw/vh` +
  `panelClass: 'fullscreen-dialog'` when `!isDesktop()`; 640px otherwise
  (assert the `MatDialog.open` config).

## Acceptance criteria

- [ ] AI sidebar is a full-width overlay `<1024`, a side pane `≥1024`.
- [ ] Search dialog is full-screen `<1024`, 640px centered `≥1024`.
- [ ] No content squeeze from the AI panel on mobile.
- [ ] Specs assert the dialog config + the AI host class per breakpoint.

## Out of scope

- AI feature behaviour (Phase 7); search feature behaviour (Phase 6).
