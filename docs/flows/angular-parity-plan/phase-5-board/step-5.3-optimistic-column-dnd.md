# Step 5.3 — Optimistic column DnD + rollback

| | |
|---|---|
| Phase | 5 — Board view |
| Gap refs | §3.5 "DnD — column-to-column"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | 1.2 (invalidation) |
| Est. size | M |

## Problem

React: column-to-column drag (change `state`) does an **optimistic cache
patch → `PUT` → rollback + toast on failure**. Angular does `PUT` then a
version-bump refetch — **no optimism**; the card doesn't move until the server
responds; a toast shows on failure but there is nothing to roll back.

## Target behaviour

- On drop into another column, immediately move the card in the local model and
  set its `state` to the target column's value.
- Fire the `PUT /pages/:guid` with the new `state`.
- On success, reconcile with the server response (or a scoped invalidation).
- On failure, **roll back** the local move to its prior column/position and
  show a toast ("Couldn't move card — {server message}").

## Implementation notes

**Files:** `features/board/board-view.ts`, `features/board/board-column.ts`.

- Keep a snapshot of the affected card's `{ state, boardOrder, columnId }`
  before the optimistic mutation; restore it on error.
- Use the local accumulator from step 5.2 as the source of truth the UI
  renders; the optimistic patch mutates that.
- Scoped invalidation (step 1.2) on success — but do **not** let a broad
  refetch stomp an in-flight optimistic state; gate it.

## Tests first (TDD)

- `board-view.spec.ts`: drop card A from "Todo" to "Doing" → A renders in
  "Doing" immediately, `PUT` sent with `state: 'doing'`; on `PUT` success it
  stays; on `PUT` failure A returns to "Todo" and a toast shows the server
  message.

## Acceptance criteria

- [ ] Cross-column drop moves the card immediately (optimistic).
- [ ] Failure rolls back to the exact prior state + toast.
- [ ] Success reconciles without a visible jump.
- [ ] Tests cover success + failure/rollback.

## Out of scope

- Positional ordering within the column (→ 5.4 builds on this).
