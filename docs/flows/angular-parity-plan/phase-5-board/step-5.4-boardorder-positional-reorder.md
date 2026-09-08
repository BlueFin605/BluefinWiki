# Step 5.4 — `boardOrder` positional reorder

| | |
|---|---|
| Phase | 5 — Board view |
| Gap refs | §3.5 "DnD — reorder within / into a column at a position"; §11 checklist; punch list 🔴 #11 |
| Impact | 🔴 Functional |
| Depends on | 5.3 (optimistic move infra) |
| Est. size | L |

## Problem

React `onCardReorder`: gap-based `boardOrder` midpoints, `±1000` at the ends,
a full-column renumber fallback, and a cross-column drop sets `state` **and**
`boardOrder` in the same `PUT`. Angular `board-column.onDrop` only emits
`{ card, targetState }` — position is ignored; nothing writes `boardOrder`
(though the sort already reads it and the API supports it).

## Target behaviour

- Dropping a card at index `i` in a column computes a new `boardOrder`:
  - between two neighbours → midpoint of their `boardOrder`s,
  - at the top → `firstNeighbour.boardOrder - 1000`,
  - at the bottom → `lastNeighbour.boardOrder + 1000`,
  - empty column → a base value (e.g. `1000`).
- If the midpoint would collide / lose precision (neighbours differ by < ~2),
  **renumber the whole column** (`1000, 2000, 3000, …`) and `PUT` each changed
  card (or a batch endpoint if one exists — confirm).
- Cross-column drop: one `PUT` per moved card carrying **both** `state` and
  `boardOrder`.
- Optimistic + rollback, reusing step 5.3's snapshot mechanism.
- Card sort stays `boardOrder` asc then `modifiedAt` desc (already correct).

## Implementation notes

**Files:** `features/board/board-column.ts` (emit an index/position),
`features/board/board-view.ts` (compute + persist), a pure
`computeBoardOrder(columnCards, targetIndex) => { value } | { renumber: [{guid, value}] }`
helper.

- The helper is the heart of this step — unit-test every branch.
- `board-column.onDrop` payload becomes `{ card, targetState, targetIndex }`.

## Tests first (TDD)

- `compute-board-order.spec.ts`: insert between 1000 & 2000 → 1500; at top of
  [1000,2000] → 0 (i.e. 1000−1000); at bottom → 3000; into an empty column →
  1000; neighbours 1000 & 1001 (gap < 2) → `renumber` list `1000,2000,…`.
- `board-view.spec.ts`: same-column reorder issues the right `PUT`(s);
  cross-column carries `state` + `boardOrder` in one `PUT`; failure rolls back;
  renumber path issues the batch.

## Acceptance criteria

- [ ] Positional drops compute `boardOrder` by midpoint / ±1000 ends.
- [ ] Renumber fallback triggers on gap exhaustion.
- [ ] Cross-column sets `state` + `boardOrder` together.
- [ ] Optimistic + rollback (via 5.3).
- [ ] `computeBoardOrder` fully unit-tested.

## Out of scope

- Card summary editing (→ 5.7).
