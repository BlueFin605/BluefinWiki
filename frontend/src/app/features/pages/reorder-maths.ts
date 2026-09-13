import type { PageSummary } from './page.types';

/**
 * The slice of a child `PageSummary` the reorder maths needs: just its guid.
 * `Pages.fetchChildren(...)` results are structurally assignable, so callers
 * pass them straight through.
 */
export type ReorderSibling = Pick<PageSummary, 'guid'>;

export interface ReorderResult {
  /**
   * `true` when the moving page is not already among `siblings` — i.e. the drop
   * crosses parents and the caller must `movePage` before `reorderPages`.
   * `false` for a same-parent reorder, which needs no move.
   *
   * Deliberately a flag and **not** a parent guid: the caller already holds the
   * authoritative target parent guid (the dropped-on row's `parentGuid`) and
   * passes it to both `movePage` and `reorderPages`. A guid re-derived here from
   * a possibly stale sibling list could disagree with it and split the mutation
   * across two different parents.
   */
  crossParent: boolean;
  /**
   * The target parent's child guids in their new order, with the moving page
   * spliced into its new index. Feed straight to `reorderPages({ parentGuid,
   * orderedGuids })`.
   */
  orderedGuids: string[];
}

/**
 * Pure, DOM-free reorder maths for a positional (`before` / `after`) tree drop.
 *
 * `siblings` is the **target parent's** current child list. When `movingGuid` is
 * already in it the drop is a same-parent reorder (`crossParent: false`); when it
 * is not, the drop crosses parents and the caller runs the two-step `movePage` →
 * `reorderPages` against its own target parent guid.
 *
 * The moving page is always removed from the base list first, so "move down" and
 * "move up" both reduce to a single splice relative to the target's index in the
 * moving-excluded list. A `targetGuid` that is not in the list at all (stale
 * payload — the row moved or was deleted server-side since the tree rendered)
 * appends the moving page rather than failing.
 */
export function computeReorder(
  siblings: readonly ReorderSibling[],
  movingGuid: string,
  targetGuid: string,
  zone: 'before' | 'after',
): ReorderResult {
  const crossParent = !siblings.some((s) => s.guid === movingGuid);

  const base = siblings.filter((s) => s.guid !== movingGuid).map((s) => s.guid);
  const targetIdx = base.indexOf(targetGuid);
  const insertIdx =
    targetIdx === -1
      ? base.length
      : zone === 'before'
        ? targetIdx
        : targetIdx + 1;

  const orderedGuids = [
    ...base.slice(0, insertIdx),
    movingGuid,
    ...base.slice(insertIdx),
  ];

  return { crossParent, orderedGuids };
}
