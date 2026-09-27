/**
 * Minimal shape `computeBoardOrder` needs from a card: its guid (to name it
 * in a renumber result) and its current `boardOrder` (to find neighbours'
 * gaps). A full `PageChildDetail` satisfies this structurally.
 */
export interface BoardOrderCard {
  guid: string;
  boardOrder?: number;
}

export type ComputeBoardOrderResult =
  | { value: number }
  | { renumber: Array<{ guid: string; value: number }> };

/**
 * Pure `boardOrder` maths for dropping a card at a position within a column
 * (step 5.4). Mirrors the React reference's `onCardReorder`: gap-based
 * midpoints between neighbours, `±1000` at the ends, `1000` for an empty
 * column, and a full-column renumber fallback when the gap between
 * neighbours is too small to hold a distinct integer midpoint.
 *
 * `columnCards` is the column's cards in their FINAL order, with the
 * dragged card already spliced in at `targetIndex` — its own `boardOrder`
 * is never read, only its `guid` and position. Splicing the dragged card in
 * up front (rather than passing it as a separate parameter) means the
 * renumber branch can name every affected card, dragged one included, in a
 * single pass: the caller doesn't need to separately re-derive the dragged
 * card's post-renumber value.
 *
 * **Normalising invariant (fix wave 3).** A column card other than the
 * mover that has *no* `boardOrder` at all (e.g. every card on a board that
 * predates step 5.4, which are ordered purely by the `modifiedAt` sort
 * tiebreak) is treated as **gap exhaustion** and routes to the renumber
 * fallback — it is emphatically NOT treated as `0`. Treating it as `0`
 * silently corrupted the column, because `group-by-state.ts` sorts cards
 * that HAVE a `boardOrder` *before* all that don't: dropping a card at the
 * bottom of an all-unordered column `[A, B, C]` used to compute
 * `(undefined ?? 0) + 1000 = 1000` for the mover, leaving it the only card
 * with an order — so it re-rendered FIRST, not last, and persisted that
 * way. Renumbering instead gives every card in the column an explicit
 * `boardOrder`, which is exactly the precondition `group-by-state.ts`'s
 * sort needs to agree with the drop the user just made. So: after any drop
 * this helper governs, every card in the affected column carries a
 * `boardOrder` (modulo a PUT that fails, which rolls back).
 *
 * The renumber fallback assigns a fresh sequential value to every card in
 * the column, but only *returns* entries for cards whose value actually
 * differs from their current `boardOrder` — a card that happens to land
 * back on its existing value is omitted, so the caller doesn't PUT (and
 * spuriously re-stamp `modifiedBy`/`modifiedAt` on) a card that didn't
 * really move. This mirrors the sibling `pages-reorder.ts` endpoint's
 * `if (page.sortOrder === newSortOrder) continue;` precedent.
 */
export function computeBoardOrder(
  columnCards: readonly BoardOrderCard[],
  targetIndex: number,
): ComputeBoardOrderResult {
  // Any non-mover card in the column without an explicit `boardOrder` makes
  // the whole column un-orderable by arithmetic alone (see the normalising
  // invariant above) — renumber, which is self-healing and gives every card
  // an order. The mover itself is exempt: its own `boardOrder` is never read.
  const needsNormalising = columnCards.some(
    (c, i) => i !== targetIndex && c.boardOrder === undefined,
  );
  if (needsNormalising) return renumberColumn(columnCards);

  const before = columnCards[targetIndex - 1];
  const after = columnCards[targetIndex + 1];

  // `?? 0` below is unreachable after the guard above (every non-mover card
  // is known to carry a `boardOrder` by here) — it only satisfies the
  // optional-property type.
  if (before && after) {
    const beforeOrder = before.boardOrder ?? 0;
    const afterOrder = after.boardOrder ?? 0;
    const gap = afterOrder - beforeOrder;
    if (gap < 2) {
      return renumberColumn(columnCards);
    }
    return { value: Math.round((beforeOrder + afterOrder) / 2) };
  }

  if (before) {
    return { value: (before.boardOrder ?? 0) + 1000 };
  }
  if (after) {
    return { value: (after.boardOrder ?? 0) - 1000 };
  }
  return { value: 1000 };
}

/**
 * Sequential `1000, 2000, 3000, …` renumber of the whole column, minus any
 * card whose new value equals the one it already has (see the doc comment
 * on {@link computeBoardOrder} for why).
 */
function renumberColumn(columnCards: readonly BoardOrderCard[]): ComputeBoardOrderResult {
  return {
    renumber: columnCards
      .map((c, i) => ({ guid: c.guid, value: (i + 1) * 1000, prior: c.boardOrder }))
      .filter((r) => r.value !== r.prior)
      .map(({ guid, value }) => ({ guid, value })),
  };
}
