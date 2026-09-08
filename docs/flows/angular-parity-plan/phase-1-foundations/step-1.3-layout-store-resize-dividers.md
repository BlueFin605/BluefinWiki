# Step 1.3 — Layout store + resize dividers (F5)

| | |
|---|---|
| Phase | 1 — Cross-cutting enablers |
| Gap refs | F5; §3.1 "Resize dividers … none"; punch list 🔴 #15 |
| Impact | 🔴 Functional |
| Depends on | none |
| Est. size | M |

## Problem

`Layout` service (`core/layout/layout.ts`) has the right keys, defaults, an
`update()` method and a localStorage `effect()` — but **nothing ever calls
`layout.update(...)`**. `ResizeDivider` (`shared/components/resize-divider.ts`)
exists and works but is **imported nowhere**. Sidebar width is read from the
store but never changed; inspector width is a hardcoded CSS value;
`inspectorVisible` and `editorSplitPosition` are unused. No clamps.

## Target behaviour

- **Tree divider:** `wiki-resize-divider` between the tree and the main area in
  the pages shell. Dragging updates `layout.update({ treeWidth })`, clamped
  **200–600**. The tree column width binds to `layout.treeWidth()`.
- **Inspector divider:** divider between the main area and the inspector.
  Dragging updates `layout.update({ inspectorWidth })`, clamped **250–600**.
  Inspector width binds to `layout.inspectorWidth()` (replaces the hardcoded
  360 px). Full inspector rebinding to `inspectorVisible` is step 4.1 — here,
  at minimum, stop hardcoding the width.
- **Clamps:** add a `clamp(value, min, max)` applied inside `Layout.update()`
  per key (`treeWidth` 200–600, `inspectorWidth` 250–600,
  `editorSplitPosition` 20–80). `update()` is the single choke point.
- **`editorSplitPosition`:** expose it for step 3.1 (Split view). No consumer
  yet in this step — just make sure `update()` clamps it.
- **`inspectorVisible`:** persist it — step 4.1 binds the panel; here ensure
  `update({ inspectorVisible })` round-trips through storage (it already does
  via the effect; just confirm with a test).
- Values survive reload (the effect already writes; verify).

## Implementation notes

**Files:** `core/layout/layout.ts` (add clamps), the pages shell template +
class (`features/pages/pages-view.ts` or a shell component — confirm which
renders the tree/main/inspector flex row), `shared/components/resize-divider.ts`
(import into the shell).

- `ResizeDivider` emits an absolute pointer X. Convert to a width relative to
  the shell's left edge (`event − hostRect.left` for the tree;
  `hostRect.right − event` for the inspector). A tiny helper or inline maths.
- Debounce/`requestAnimationFrame` the `update()` if drag feels janky — the
  store write also hits localStorage via the effect.
- Keep divider styling minimal (the component already has hover styling).

## Tests first (TDD)

- `layout.spec.ts`: `update({ treeWidth: 50 })` clamps to 200;
  `update({ treeWidth: 999 })` clamps to 600; `editorSplitPosition` clamps
  20–80; `inspectorVisible` round-trips through `readStored()`.
- Shell spec (Testing Library): simulating a `resized` emission from the tree
  divider calls `layout.update` with a clamped `treeWidth`; the tree column's
  inline width reflects `layout.treeWidth()`.

## Acceptance criteria

- [ ] Tree and inspector dividers are wired into the shell and visibly resize.
- [ ] Widths persist across reload, clamped to range.
- [ ] `Layout.update()` clamps every numeric key.
- [ ] Inspector width is no longer a hardcoded CSS constant.
- [ ] Tests cover clamps + at least one divider round-trip.

## Out of scope

- Binding the inspector open/close to `inspectorVisible` (→ 4.1).
- The editor Split view itself (→ 3.1).
- Mobile drawer behaviour (→ 1.5 / F4).
