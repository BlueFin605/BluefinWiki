# Step 2.3 — Tree arrow keys + ensureExpanded

| | |
|---|---|
| Phase | 2 — Page tree & CRUD |
| Gap refs | §0.7, §3.2 "Keyboard", §3.2 "ensureExpanded", §3.3 "force-expand parent"; punch list 🟠 |
| Impact | 🟠 |
| Depends on | none |
| Est. size | S |

## Problem

Two separate small gaps in `page-tree` / `page-tree-item`:

1. **Arrow-key expand/collapse missing.** Rows support `Enter`/`Space` select,
   `F2` rename, `dblclick` rename — but not `→`/`←`. `aria-expanded` is not set.
2. **`ensureExpanded` missing.** Creating a child (via modal or context menu)
   navigates to the new page but does **not** expand the parent in the tree.
   (A drag-reparent locally sets `_expanded` on the target only.)

## Target behaviour

- **`→`** on a collapsed row with children → expand. On an expanded row → move
  focus to the first child. On a leaf → no-op.
- **`←`** on an expanded row → collapse. On a collapsed row / leaf → move focus
  to the parent row.
- Each expandable row has `role="treeitem"` + `aria-expanded="true|false"`;
  the container has `role="tree"` (confirm current ARIA and fill gaps).
- After `createPage` (any entry point), `pages-view` sends a force-expand
  signal for the parent guid into `PageTree`; the tree expands that node
  (loading its children if not already loaded) so the new page is visible in
  context.

## Implementation notes

**Files:** `features/pages/page-tree.ts`, `features/pages/page-tree-item.ts`,
`features/pages/pages-view.ts` (emit the expand signal after create).

- Model the force-expand as an `input<string | null>()` "expandGuid" or a
  `Subject`/signal the tree effect watches; when it changes, find the node and
  set `_expanded = true`, triggering its `childrenResource`.
- Keep `F2` / `Enter` / `Space` / `dblclick` behaviour intact.

## Tests first (TDD)

- `page-tree-item.spec.ts`: `keydown →` on a collapsed parent expands it and
  sets `aria-expanded="true"`; on an expanded parent moves focus to the first
  child; `keydown ←` collapses / moves to parent.
- `pages-view.spec.ts`: after `onNewPage` / `onNewChildRequested` resolves, the
  tree receives the parent guid as the expand target.

## Acceptance criteria

- [ ] `→`/`←` expand/collapse and move focus per the rules above.
- [ ] `aria-expanded` is present and correct on expandable rows.
- [ ] Creating a child expands its parent in the tree.
- [ ] Existing key/mouse interactions unchanged.
- [ ] Tests cover arrow keys + the expand-after-create signal.

## Out of scope

- Drag-and-drop (2.1 / 2.2).
