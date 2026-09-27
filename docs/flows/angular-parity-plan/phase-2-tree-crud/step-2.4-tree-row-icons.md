# Step 2.4 — Tree row icons

| | |
|---|---|
| Phase | 2 — Page tree & CRUD |
| Gap refs | §3.2 "Row icon", §3.2 "Page-type emoji + name in tree"; punch list part of 🟠 |
| Impact | ⚪ (folder/doc) + 🟠 (type emoji, unblocked by 1.1) |
| Depends on | 1.1 |
| Est. size | S |

## Problem

React row icon logic: **type emoji if the page is typed**, else **yellow
folder if `hasChildren`**, else grey document. Angular: type emoji if typed —
but the map is empty (fixed by 1.1) — else **always `📄`**. No folder/doc
distinction.

## Target behaviour

Per row, in priority order:

1. Page has a `pageType` present in the map with an `icon` → that emoji.
2. Else `hasChildren` (or `_expanded` with children) → folder emoji (`📁`).
3. Else → document emoji (`📄`).

## Implementation notes

**Files:** `features/pages/page-tree-item.ts` (icon computed / template).

- With step 1.1 done, the map lookup returns real types; just add the
  folder/leaf fallback branch.
- `hasChildren` source: `PageSummary.hasChildren` — confirm the field name in
  `page.types.ts`.
- Pure `rowIcon(summary, map)` helper for testability.

## Tests first (TDD)

- `page-tree-item.spec.ts` / `row-icon.spec.ts`: typed page → type icon;
  untyped with children → `📁`; untyped leaf → `📄`.

## Acceptance criteria

- [ ] Typed rows show the page-type emoji.
- [ ] Untyped rows show folder vs document based on `hasChildren`.
- [ ] `rowIcon` is a tested pure helper.

## Out of scope

- Active-row left-bar styling (⚪, not in scope).
