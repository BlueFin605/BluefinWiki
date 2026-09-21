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

## Known debt

- **Item 2 (>200-card pagination) e2e coverage deferred.** `e2e/tests/board-pagination.spec.ts`
  exists (spec written and both selectors verified against the real DOM) but is `test.skip`'d.
  Fixture creation (201 pages under one parent) cannot finish in bounded time: every page
  creation calls `storagePlugin.listChildren(parentGuid)` to compute `sortOrder`, and
  `S3StoragePlugin.listChildren` does a sequential per-child S3 round-trip — making bulk
  creation under one parent O(n²). Measured: a single, zero-concurrency `POST /pages` at 150
  existing siblings took 9.2s. Not fixable from the e2e side (batching/timeout tuning). User
  chose to defer (2026-09-21) rather than fix the backend as part of this e2e plan. Real fix
  belongs in `backend/src/pages/pages-create.ts`'s sortOrder computation and/or
  `S3StoragePlugin.listChildren`'s per-child scan — see the skipped test's own comment for
  full detail.
