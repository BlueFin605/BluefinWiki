import type { PageSummary } from './page.types';

/**
 * The slice of a child `PageSummary` the reorder maths needs: its guid and the
 * guid of the parent it currently sits under. `Pages.fetchChildren(...)` results
 * are structurally assignable, so callers pass them straight through.
 */
export type ReorderSibling = Pick<PageSummary, 'guid' | 'parentGuid'>;

export interface ReorderResult {
  /**
   * Present **only** for a cross-parent drop — the guid of the parent the moving
   * page must first be `movePage`d into (`null` for the root level). Absent for a
   * same-parent reorder, which needs no move. Test with `'moveTo' in result`.
   */
  moveTo?: string | null;
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
 * already in it the drop is a same-parent reorder (no `moveTo`); when it is not,
 * the drop crosses parents and the result carries `moveTo` = the target parent
 * guid so the caller can run the two-step `movePage` → `reorderPages`.
 *
 * The moving page is always removed from the base list first, so "move down" and
 * "move up" both reduce to a single splice relative to the target's index in the
 * moving-excluded list.
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

  if (!crossParent) return { orderedGuids };

  const targetParentGuid =
    siblings.find((s) => s.guid === targetGuid)?.parentGuid ?? null;
  return { moveTo: targetParentGuid, orderedGuids };
}
