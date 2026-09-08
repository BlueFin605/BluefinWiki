# Phase 1 — Cross-cutting enablers

**Goal:** land the shared infrastructure that later phases depend on. Nothing
here is user-visible on its own except the resize dividers and the editor keymap.

**Depends on:** Phase 0 (so runtime verification is trustworthy).

**Blocks:**

| Step | Unblocks |
|---|---|
| 1.1 PageTypes wiring | 2.2, 2.4, 2.6, 4.4, 5.1, 5.5, 5.7 |
| 1.2 per-resource invalidation | 7.1 (action runner), and de-risks every mutation in 2–5 |
| 1.3 layout store + dividers | 3.1 (split position), 4.1 (inspector width/visible) |
| 1.4 editor keymap | — (self-contained) |
| 1.5 responsive layer → **Phase 1b** | designed up front; executes after Phases 3 & 4; completes mobile variants in 3.4, 3.5, 3.10, 4.1, 6.7 |

## Steps

| # | Step | Impact | Notes |
|---|---|---|---|
| 1.1 | [PageTypes wiring](step-1.1-pagetypes-wiring.md) | 🔴 root cause | Highest leverage. Do first. |
| 1.2 | [Per-resource invalidation](step-1.2-per-resource-invalidation.md) | 🟠 (F2) | Establish pattern, migrate all services. |
| 1.3 | [Layout store + resize dividers](step-1.3-layout-store-resize-dividers.md) | 🔴 (F5) | `ResizeDivider` + `Layout` both exist; wire them. |
| 1.4 | [Editor formatting keymap](step-1.4-editor-formatting-keymap.md) | 🟠 (§0.7) | CodeMirror keymap only. |
| 1.5 | [Responsive layer → Phase 1b](step-1.5-responsive-layer.md) | 🔴 (F4) | **Designed** — see [`../phase-1b-responsive/`](../phase-1b-responsive/README.md). Executes after Phases 3 & 4. |

Order: 1.1 → 1.2 → 1.3 → 1.4 in sequence (1.1/1.2 touch many service files;
avoid merge churn). 1.5 is design-only in this phase; its code is Phase 1b.

## Phase exit criteria

- [ ] Every step's acceptance criteria met (1.5: design approved — code is 1b).
- [ ] `npm test` green, `npm run lint` clean.
- [ ] `pages-view` feeds a real page-types map to `PageTree` (visible: type
      emoji appears on typed rows).
- [ ] Dragging the tree / inspector divider resizes the pane and the width
      survives a reload, clamped to range.
- [ ] `Ctrl/Cmd+B / I / \` / Shift+X` format text in the editor;
      `Ctrl/Cmd+K` inserts a link when the editor is focused.
- [ ] A single mutation no longer refetches every unrelated resource of a
      service (spot-check via network panel or a spy).
