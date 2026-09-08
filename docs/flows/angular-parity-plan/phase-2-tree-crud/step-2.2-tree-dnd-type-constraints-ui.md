# Step 2.2 — Tree DnD: type-constraint UI

| | |
|---|---|
| Phase | 2 — Page tree & CRUD |
| Gap refs | §3.2 "Drag & drop — type constraints"; punch list 🔴 #1 |
| Impact | 🔴 Functional |
| Depends on | 1.1 (populated map), 2.1 (zone detection) |
| Est. size | M |

## Problem

`check-type-constraints.ts` logic is ported correctly but is fed the **empty**
`pageTypesMap`, so it never rejects anything. Enforcement is only via
`cdkDropListEnterPredicate`, which **silently** refuses entry — no amber
warning, no tooltip, no `alert` explaining why. On-drop reparent does not
re-check constraints. React shows: amber indicator + warning triangle + tooltip
listing reasons + `dropEffect='none'` + `alert("Cannot move here: …")` on drop.

## Target behaviour

- With the real map (step 1.1), `checkTypeConstraints(moving, target, map)`
  returns `{ allowed, reasons[] }`.
- During drag-over of a disallowed target:
  - amber row indicator + a warning-triangle icon,
  - tooltip / inline text listing `reasons`,
  - cursor / `dropEffect` reflects "not allowed".
- On an attempted drop into a disallowed target: block the mutation and show
  `alert("Cannot move here:\n" + reasons.join("\n"))` (match React's copy).
- **Re-check on drop**, not only on enter — the `onto` (reparent) path and the
  cross-parent before/after path both re-run `checkTypeConstraints` before
  calling `movePage`.
- Allowed drops behave exactly as step 2.1 defines.

## Implementation notes

**Files:** `features/pages/check-type-constraints.ts` (should be unchanged —
verify), `features/pages/page-tree-item.ts` (drag-over visuals + tooltip),
`features/pages/pages-view.ts` (on-drop re-check + `alert`).

- Keep `cdkDropListEnterPredicate` as a backstop, but the user-facing feedback
  comes from the drag-over state you compute.
- The `reasons` strings come straight from `check-type-constraints.ts`; don't
  reword them here.
- Amber = a class like `.drop-invalid`; keep styling minimal.

## Tests first (TDD)

- `check-type-constraints.spec.ts`: with a populated map, a disallowed
  child/parent pair returns `allowed: false` + non-empty `reasons`; an allowed
  pair returns `allowed: true`.
- `page-tree-item.spec.ts`: dragging over a disallowed target adds the
  `drop-invalid` class and renders the warning icon + reasons.
- `pages-view.spec.ts`: dropping onto a disallowed target calls `window.alert`
  with the reasons and does **not** call `movePage`.

## Acceptance criteria

- [ ] Disallowed targets show amber + warning triangle + reasons during drag.
- [ ] Dropping on a disallowed target is blocked and `alert`s the reasons.
- [ ] Constraints are re-checked on drop for both reparent and cross-parent
      reorder.
- [ ] Tests cover allowed + disallowed, drag-over + drop.

## Out of scope

- Constraint enforcement in the New Page modal (→ 2.6) or board settings
  (→ 5.5) — same `check-type-constraints` / map, different surfaces.
