# Phase 5 — Board view

**Goal:** bring the board (kanban) view to React parity — eligibility,
pagination, optimistic DnD, `boardOrder` positional reorder, settings filtering,
and the card summary dialog editing.

**Depends on:** Phase 1 step 1.1 (page-types map) for eligibility + settings
filtering + card summary property editing. Step 1.2 (invalidation) for the DnD
mutations.

**Backend note:** `childrenWithPropertiesResource` already returns
`hasMore` / `nextCursor` (`features/pages/pages.ts:28-32`); `BoardView` just
never reads them. The API already supports `boardOrder`.

## Steps

| # | Step | Impact | Depends on |
|---|---|---|---|
| 5.1 | [Child-state eligibility](step-5.1-child-state-eligibility.md) | 🟠 | 1.1 |
| 5.2 | [Pagination / Load-more](step-5.2-board-pagination-load-more.md) | 🔴 | — |
| 5.3 | [Optimistic column DnD + rollback](step-5.3-optimistic-column-dnd.md) | 🟠 | 1.2 |
| 5.4 | [`boardOrder` positional reorder](step-5.4-boardorder-positional-reorder.md) | 🔴 | 5.3 |
| 5.5 | [Board Settings: boardable types](step-5.5-board-settings-boardable-types.md) | 🟠 | 1.1 |
| 5.6 | [Card: respect `showParentTitle`](step-5.6-card-show-parent-title.md) | ⚪→do | — |
| 5.7 | [Card Summary: inline edit](step-5.7-card-summary-inline-edit.md) | 🔴 | 1.1, 4.5 (tag input) |

Parallel-safe: {5.1, 5.2, 5.5, 5.6} independent; {5.3 → 5.4} sequential;
5.7 independent (reuses the tag input + `mergeSchema` from Phase 4).

## Phase exit criteria

- [ ] All step acceptance criteria met; `npm test` + `npm run lint` green.
- [ ] Manual: a page whose children carry a `state` property is board-eligible
      even without `boardConfig.targetTypeGuid`.
- [ ] Manual: a board with >200 cards shows "Load more cards" and loads the
      next page.
- [ ] Manual: dragging a card between columns moves it immediately; a failed
      `PUT` rolls it back with a toast.
- [ ] Manual: dropping a card at a position within/into a column persists the
      order (`boardOrder`) and survives reload.
- [ ] Manual: Board Settings "Show pages of type" lists only state-bearing
      (boardable) types.
- [ ] Manual: the Card Summary dialog edits title + properties, saves, and
      "Open full editor" opens a new tab.
