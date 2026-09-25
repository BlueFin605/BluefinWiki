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

- [x] All step acceptance criteria met; `npm test` + `npm run lint` green.
- [x] Manual: a page whose children carry a `state` property is board-eligible
      even without `boardConfig.targetTypeGuid`. Automated:
      `e2e/tests/board-eligibility.spec.ts` (2 tests, passing).
- [ ] Manual: a board with >200 cards shows "Load more cards" and loads the
      next page. **Not automated — see "Known debt" below**
      (`e2e/tests/board-pagination.spec.ts` written but `test.skip`'d).
- [x] Manual: dragging a card between columns moves it immediately; a failed
      `PUT` rolls it back with a toast. Automated:
      `e2e/tests/board-drag-columns.spec.ts` (2 tests, passing).
- [x] Manual: dropping a card at a position within/into a column persists the
      order (`boardOrder`) and survives reload. Automated:
      `e2e/tests/board-drag-reorder.spec.ts` (1 test, passing).
- [x] Manual: Board Settings "Show pages of type" lists only state-bearing
      (boardable) types. Automated:
      `e2e/tests/board-settings-types.spec.ts` (2 tests, passing).
- [x] Manual: the Card Summary dialog edits title + properties, saves, and
      "Open full editor" opens a new tab. Automated: extends the existing
      `e2e/tests/board-view-functional.spec.ts` (2 tests, passing) rather
      than a wholly new spec — it already covered title/state edit + save +
      live column move; this phase's close-out added Save-disabled-until-dirty
      and "Open full editor" opens a new tab at the right URL.

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

- **Confirmed cross-file flake in `board-settings-types.spec.ts`'s "no boardable types at
  all" test, under the default full-suite run.** Task 6's report already flagged this as a
  theoretical residual risk (`boardableTypes()` filters the entire backend's page-type list,
  which is genuinely global across every e2e spec file); this task's full-suite regression
  check (`cd e2e && npx playwright test`, default `fullyParallel: true` / 3 workers)
  reproduced it twice in a row — `board-settings-types.spec.ts:53` failed both times because
  another worker (e.g. `board-view-functional.spec.ts`, `board-eligibility.spec.ts`) held a
  live state-bearing page type at the same moment. Confirmed as a pure scheduling race, not a
  broken test or a product bug: `board-settings-types.spec.ts` run alone is 2/2 reliably, and
  a `PW_WORKERS=1` full-suite run let it pass (a different, unrelated pre-existing flake in
  `tree-drag-reorder.spec.ts` showed up instead). Fixing this needs either backend-side
  scoping of `boardableTypes()` or a suite-level serialization decision — both out of this
  task's scope; left as documented debt per Task 6's own concerns section.
