# Step 2.1 — Tree DnD: positional reorder

| | |
|---|---|
| Phase | 2 — Page tree & CRUD |
| Gap refs | §3.2 "Drag & drop — reorder", §11 checklist; punch list 🔴 #1 |
| Impact | 🔴 Functional |
| Depends on | 1.1 |
| Est. size | L |

## Problem

Angular's CDK drop has no positional zones. `PageTreeItem.onDrop` only ever
calls `movePage` (reparent). You **cannot reorder siblings by dragging**. React
has `before` / `after` zones (top / bottom 25 % of a row), calls
`PUT /pages/reorder`, and splices the page into the new index; a cross-parent
`before`/`after` drop is a two-step "move then reorder".

## Target behaviour

- While dragging over a row, detect three zones by pointer Y within the row
  rect: top 25 % → **before**, bottom 25 % → **after**, middle 50 % → **onto**
  (reparent — the existing behaviour).
- Visual indicator per zone: a line above / below for before/after, row
  highlight for onto.
- **before/after, same parent:** call `Pages.reorderPages({ ... })` with the
  target sibling list re-spliced to the new index. Confirm the `ReorderRequest`
  shape in `page.types.ts` (parent guid + ordered child guids, or guid +
  index — match what the endpoint expects).
- **before/after, different parent:** two-step — `movePage(guid, newParent)`
  then `reorderPages(...)` for the new parent's list. Sequential; roll the UI
  back if the second call fails.
- **onto:** unchanged (`movePage`), but now also subject to step 2.2
  constraints.
- Drop onto self / into own descendant = no-op (already handled — keep).
- After success, invalidate `children:<parent>` (both parents for cross-parent)
  per step 1.2.

## Implementation notes

**Files:** `features/pages/page-tree.ts`, `features/pages/page-tree-item.ts`,
`features/pages/pages-view.ts` (handler wiring), `features/pages/page.types.ts`
(check `ReorderRequest`).

- Keep using CDK drag-drop for the drag mechanics; compute the zone in
  `cdkDragMoved` / a `dragover`-style handler on the row, store it on the item,
  read it in `onDrop`.
- `cdkDropListEnterPredicate` still guards illegal *targets* (step 2.2), but
  the before/after/onto decision is pointer-position based, not predicate
  based.
- Factor the index-splice + two-step logic into a pure helper
  (`computeReorder(siblings, movingGuid, targetGuid, zone)` → `{ moveTo?,
  orderedGuids }`) so it is unit-testable without the DOM.

## Tests first (TDD)

- `reorder-maths.spec.ts` (pure helper): before/after within a list produces
  the right ordered guid array; moving down vs up; cross-parent returns a
  `moveTo` plus the new parent's ordering.
- `page-tree-item.spec.ts`: pointer at 10 % of the row height → zone `before`;
  90 % → `after`; 50 % → `onto`.
- `pages-view.spec.ts` (Testing Library + spies): same-parent after-drop calls
  `reorderPages` once, not `movePage`; cross-parent after-drop calls
  `movePage` then `reorderPages`; failure of the second rolls back.

## Acceptance criteria

- [ ] Sibling reorder by drag works and persists across reload.
- [ ] before / after / onto zones are detected and visually indicated.
- [ ] Cross-parent before/after does move-then-reorder with rollback on
      partial failure.
- [ ] Reorder maths is a tested pure helper.
- [ ] Correct `children` tags invalidated (1.2).

## Out of scope

- Type-constraint warnings / blocking (→ 2.2).
- Root drop zone (already present — keep).
