/**
 * `boardOrder` placement for newly written pages.
 *
 * ## Why this exists
 *
 * A card with no `boardOrder` is not merely unsorted — it actively breaks the
 * board. Two things conspire:
 *
 *  1. `group-by-state.ts` sorts cards that *have* a `boardOrder` ahead of all
 *     that don't, so an unordered card is forced to the bottom of its column
 *     regardless of where it belongs.
 *  2. `compute-board-order.ts`'s `needsNormalising` guard treats *any*
 *     unordered card in a column as gap exhaustion and routes the next drop
 *     in that column to a full-column renumber — one PUT per card.
 *
 * On a long column that renumber is 30-50 concurrent `PUT /pages/{guid}`
 * calls. This AWS account's Lambda ceiling is 50 concurrent executions, so
 * the burst pins it, Lambda throttles the overflow, and API Gateway maps the
 * throttle to a bare 500. The failed PUTs leave those cards still unordered,
 * so the next drop renumbers again — a self-sustaining loop.
 *
 * Assigning a `boardOrder` at every write is what breaks that loop: it is the
 * *absence* of the value, not its precision, that causes the damage.
 *
 * ## Known limitation
 *
 * A column is defined by a card's `state` property, which a freshly created
 * page usually doesn't have yet — so this appends past the highest
 * `boardOrder` among *all* siblings rather than within one column. That
 * guarantees the value is defined and that it sits above every sibling, so
 * the card lands at the bottom of whichever column it resolves into.
 *
 * On a *deep* board (`targetTypeGuid` set) a single column aggregates
 * descendants from several different parents, so a sibling-local max is not
 * guaranteed to be the global column max and placement may not be exactly
 * last. That is accepted deliberately: computing a true global max would
 * require loading the whole board on every create, and the defect being
 * fixed is the undefined value, not the precise slot.
 */

/**
 * Gap left between adjacent cards. Matches `compute-board-order.ts` — its
 * empty-column value, its `±1000` end inserts, and `renumberColumn`'s
 * `(i + 1) * 1000` sequence — so appended cards share the grid the frontend
 * already uses, leaving room for midpoint inserts either side.
 */
export const BOARD_ORDER_STEP = 1000;

/** The only field this reads; `PageSummary` and `PageContent` both satisfy it. */
interface HasBoardOrder {
  boardOrder?: number;
}

/**
 * The `boardOrder` to give a page being appended alongside `siblings`:
 * one step past the highest value present, or `BOARD_ORDER_STEP` when none
 * of them carries one.
 *
 * Siblings need not be sorted. Those without a `boardOrder` are skipped
 * rather than counted as `0` — treating absent as zero is the bug this
 * module exists to prevent, and it would also drag the max down below real
 * negative values.
 *
 * The result is rounded up to an integer because `boardOrder` is declared
 * `z.number().int()` on both the create and update request schemas; a
 * fractional max (left behind by a midpoint insert) would otherwise produce
 * a body the API rejects.
 */
export function nextBoardOrder(siblings: readonly HasBoardOrder[]): number {
  let max: number | undefined;
  for (const sibling of siblings) {
    if (sibling.boardOrder === undefined) continue;
    if (max === undefined || sibling.boardOrder > max) max = sibling.boardOrder;
  }
  if (max === undefined) return BOARD_ORDER_STEP;
  return Math.ceil(max) + BOARD_ORDER_STEP;
}
