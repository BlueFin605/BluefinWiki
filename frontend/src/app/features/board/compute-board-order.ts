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
 * A neighbour lacking an explicit `boardOrder` (e.g. it was never
 * positioned and is only present via the `modifiedAt` sort tiebreak) is
 * treated as `0` for gap/midpoint purposes.
 */
export function computeBoardOrder(
  columnCards: readonly BoardOrderCard[],
  targetIndex: number,
): ComputeBoardOrderResult {
  const before = columnCards[targetIndex - 1];
  const after = columnCards[targetIndex + 1];

  if (before && after) {
    const beforeOrder = before.boardOrder ?? 0;
    const afterOrder = after.boardOrder ?? 0;
    const gap = afterOrder - beforeOrder;
    if (gap < 2) {
      return {
        renumber: columnCards.map((c, i) => ({ guid: c.guid, value: (i + 1) * 1000 })),
      };
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
