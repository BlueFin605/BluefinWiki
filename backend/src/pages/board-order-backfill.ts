/**
 * `boardOrder` backfill: gives every card beneath a page an explicit
 * `boardOrder`, preserving the order the board already displays.
 *
 * ## Why
 *
 * Pages created before `boardOrder` existed — and any created since by a path
 * that didn't set it — carry no value. `compute-board-order.ts`'s
 * `needsNormalising` guard treats a single unordered card in a column as gap
 * exhaustion and routes the next drag there into a full-column renumber, one
 * PUT per card. That burst throttles against this account's 50-concurrency
 * Lambda ceiling and surfaces to the browser as a 500.
 *
 * Writing the values server-side, in one invocation, normalises those columns
 * without the browser ever issuing the storm.
 *
 * ## Ordering
 *
 * Columns are grouped and sorted exactly as `group-by-state.ts` does, so the
 * numbering matches what users currently see and nobody's board is
 * reshuffled: cards with a `boardOrder` ascending first, then cards without
 * one by `modifiedAt` descending.
 *
 * Idempotent: only cards whose value actually changes are written, mirroring
 * `pages-reorder.ts`'s `if (page.sortOrder === newSortOrder) continue;` and
 * `renumberColumn`'s own filter. A second run writes nothing.
 *
 * ## Scope
 *
 * Takes a root guid and walks down from it, like `ticket-keys-backfill` does,
 * rather than sweeping the whole wiki — that keeps the read count bounded
 * well inside the Lambda and API Gateway timeouts. Run it once per board (or
 * per top-level section).
 *
 * Reads come from `listChildren`, which already returns `boardOrder`,
 * `modifiedAt` and `properties` on each summary, so only the cards being
 * *written* cost a `loadPage`.
 */

import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { BOARD_ORDER_STEP } from './board-order.js';
import type { PageSummary } from '../types/index.js';

/** Column for a card with no usable `state` — matches group-by-state.ts. */
const UNCATEGORISED = 'Uncategorised';

export interface BoardOrderBackfillResult {
  /** Cards whose `boardOrder` was written. */
  updated: number;
  /** Cards examined, whether written or not. */
  examined: number;
}

/** The column a card belongs to, by the same rule the board view uses. */
function columnOf(card: PageSummary): string {
  const value = card.properties?.['state']?.value;
  return typeof value === 'string' && value ? value : UNCATEGORISED;
}

/**
 * `group-by-state.ts`'s within-column comparator: ordered cards ascending
 * come first, then unordered cards by `modifiedAt` descending.
 */
function byBoardPosition(a: PageSummary, b: PageSummary): number {
  const aHas = a.boardOrder !== undefined;
  const bHas = b.boardOrder !== undefined;
  if (aHas && bHas) return (a.boardOrder ?? 0) - (b.boardOrder ?? 0);
  if (aHas) return -1;
  if (bHas) return 1;
  return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
}

export async function backfillBoardOrder(rootGuid: string): Promise<BoardOrderBackfillResult> {
  const storage = getStoragePlugin();

  // Validate the root before walking. The walk itself only ever calls
  // listChildren, which answers an empty list for a guid that doesn't exist
  // — so without this a typo'd guid returns a cheerful
  // `{updated: 0, examined: 0}` and the operator believes the backfill ran
  // and found nothing to do. Let the PAGE_NOT_FOUND propagate; the handler
  // turns it into a 404.
  await storage.loadPage(rootGuid);

  let updated = 0;
  let examined = 0;

  const normalise = async (parentGuid: string): Promise<void> => {
    const children = await storage.listChildren(parentGuid);
    if (children.length === 0) return;

    const columns = new Map<string, PageSummary[]>();
    for (const child of children) {
      const column = columnOf(child);
      const cards = columns.get(column);
      if (cards) cards.push(child);
      else columns.set(column, [child]);
    }

    for (const cards of columns.values()) {
      cards.sort(byBoardPosition);
      for (let i = 0; i < cards.length; i++) {
        examined++;
        const card = cards[i];
        const target = (i + 1) * BOARD_ORDER_STEP;
        if (card.boardOrder === target) continue;

        // Re-read the full page: listChildren's summary is not the whole
        // document, and savePage writes the document.
        const page = await storage.loadPage(card.guid);
        await storage.savePage(card.guid, page.folderId || null, { ...page, boardOrder: target });
        updated++;
      }
    }

    // Recurse after writing this level, so a deep board's descendants are
    // normalised too. Sequential rather than Promise.all: this runs against
    // S3 inside a single invocation and there is no deadline pressure worth
    // trading a wide fan-out for.
    for (const child of children) {
      await normalise(child.guid);
    }
  };

  await normalise(rootGuid);
  return { updated, examined };
}
