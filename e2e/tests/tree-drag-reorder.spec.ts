import { test, expect, createPage } from '../fixtures/page-tree';
import { createPageType, deletePageType, allowChildTypes } from '../fixtures/page-types';
import type { Locator, Page } from '@playwright/test';

/**
 * Drags `source` to land in the `before` zone (top 10%) of `targetRow`,
 * for a genuinely ADJACENT sibling (the case `dragToRowZone` — a single,
 * up-front-computed target point, see helpers.ts — does not handle).
 *
 * Investigation for this task (see task-2-report.md) found that for two
 * adjacent siblings, the moment the drag enters the target's zone with a
 * valid `before`/`after` classification, CDK's "sort preview" visually
 * relocates the target row (translating it out of the way) to show where the
 * dragged item will land. Because the mouse cursor stays put while the
 * target's painted box moves out from under it, the browser fires a genuine
 * `pointerleave` on the target — which `page-tree-item.ts`'s
 * `onRowDragLeave()` uses to reset its `_dropZone` signal back to `null`.
 * `onDrop` then reads that `null` and falls back to `'onto'` (reparent)
 * instead of the intended `before`/`after` reorder — a single static target
 * point can never land correctly here, no matter how far inside the 25%
 * zone it aims (confirmed empirically: this fails 100% of the time, not
 * intermittently, so widening the zone band does not help).
 *
 * A real user succeeds here because their eye+hand naturally track the
 * shifting drop-indicator and keep the pointer over the target as it moves.
 * This helper reproduces that: it re-reads the target's LIVE bounding box on
 * every step and eases the pointer toward its current (possibly just-shifted)
 * 10%-zone point, rather than committing to one pre-drag coordinate. This is
 * a *convergent* correction (small steps continuously re-aiming at a
 * settling target), not the *chasing oscillation* the tree-reparent.spec.ts
 * comments warn about (a single big corrective jump re-provoking the next
 * swap in a multi-row sort preview) — confirmed by 5/5 clean passes below.
 */
async function dragBeforeAdjacentSibling(page: Page, source: Locator, targetRow: Locator): Promise<void> {
  const s = await source.boundingBox();
  if (!s) throw new Error('dragBeforeAdjacentSibling: source has no bounding box');

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  // Small initial move past CDK's drag-start threshold, then a beat for
  // Angular to process `cdkDragStarted` (matches dragToRowZone's approach).
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 5, { steps: 5 });
  await page.waitForTimeout(100);

  let y = s.y + s.height / 2 + 5;
  const x = s.x + s.width / 2 + 10;
  for (let i = 0; i < 25; i++) {
    const box = await targetRow.boundingBox();
    if (!box) break;
    const wantY = box.y + box.height * 0.1; // top 10% — the 'before' zone
    y += (wantY - y) * 0.3; // ease toward the target's CURRENT position
    await page.mouse.move(x, y, { steps: 1 });
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(100);
  await page.mouse.up();
}

/**
 * Drags `source` onto the middle 50% ("onto") zone of `targetRow` and pauses
 * there — mouse still down, drop not yet completed — so the caller can
 * inspect the live hover feedback (`.drop-invalid` + the warning icon,
 * `page-tree-item.ts`) before finishing the drop with `page.mouse.up()`.
 *
 * Unlike `dragBeforeAdjacentSibling` above, dropping fully "onto" a
 * type-disallowed row doesn't suffer from the sort-preview-oscillation
 * problem adjacent before/after reorders do: `enterPredicate` rejects entry
 * into a disallowed target outright, so it never joins the drop list and
 * there's no sort-preview transform to chase. A single pre-computed target
 * point (the same shape as `dragToRowZone` in helpers.ts) is enough; this is
 * a local variant only because `dragToRowZone` doesn't expose a pause before
 * `mouse.up()`.
 */
async function dragOntoAndPause(page: Page, source: Locator, targetRow: Locator): Promise<void> {
  const s = await source.boundingBox();
  const t = await targetRow.boundingBox();
  if (!s || !t) throw new Error('dragOntoAndPause: source or target has no bounding box');

  const targetX = t.x + t.width / 2;
  const targetY = t.y + t.height / 2; // middle 50% -> 'onto'

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 5, { steps: 5 });
  await page.waitForTimeout(100);
  await page.mouse.move(targetX, targetY, { steps: 15 });
  await page.waitForTimeout(150);
}

test.describe('Tree drag reorder', () => {
  test('dragging a sibling above another persists the new order after reload', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const firstTitle = `${prefix} First`;
    const secondTitle = `${prefix} Second`;
    await createPage(request, firstTitle, { parentGuid: pageTree.rootGuid });
    await createPage(request, secondTitle, { parentGuid: pageTree.rootGuid });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
    await rootRow.getByRole('button', { name: 'Expand' }).click();

    const firstRow = page.getByRole('treeitem', { name: firstTitle });
    const secondRow = page.getByRole('treeitem', { name: secondTitle });
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    const reorderRequest = page.waitForRequest(
      (req) => req.url().includes('/api/pages/reorder') && req.method() === 'PUT',
    );

    // Drag Second to land BEFORE First.
    await dragBeforeAdjacentSibling(page, secondRow, firstRow);
    await reorderRequest;

    const orderOf = async (): Promise<string[]> => {
      const all = await page.locator('[role="treeitem"] .page-title').allTextContents();
      return all.filter((t) => t === firstTitle || t === secondTitle);
    };
    await expect.poll(orderOf).toEqual([secondTitle, firstTitle]);

    // Persists — a real reorder via PUT /api/pages/reorder, not just an
    // optimistic local splice.
    await page.reload();
    await rootRow.getByRole('button', { name: 'Expand' }).click();
    await expect.poll(orderOf).toEqual([secondTitle, firstTitle]);
  });

  test('dragging a page onto a type-disallowed parent shows the hover warning and is silently blocked', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const targetTypeName = `${prefix} Target Type`;
    const draggedTypeName = `${prefix} Dragged Type`;
    const targetTypeGuid = await createPageType(request, targetTypeName);
    const draggedTypeGuid = await createPageType(request, draggedTypeName);
    // Target type accepts only its own type as a child — draggedType is not
    // in that list, so `checkTypeConstraints` rejects the drop.
    await allowChildTypes(request, targetTypeGuid, [targetTypeGuid]);

    const targetTitle = `${prefix} Target`;
    const draggedTitle = `${prefix} Dragged`;
    await createPage(request, targetTitle, { parentGuid: pageTree.rootGuid, pageType: targetTypeGuid });
    await createPage(request, draggedTitle, { parentGuid: pageTree.rootGuid, pageType: draggedTypeGuid });

    try {
      await page.goto(`/pages/${pageTree.rootGuid}`);
      const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
      await rootRow.getByRole('button', { name: 'Expand' }).click();

      const targetRow = page.getByRole('treeitem', { name: targetTitle });
      const draggedRow = page.getByRole('treeitem', { name: draggedTitle });
      await expect(targetRow).toBeVisible();
      await expect(draggedRow).toBeVisible();
      // Both are direct children of Root (level 1): indent = 1*16+8 = 24px.
      await expect(draggedRow).toHaveCSS('padding-left', '24px');

      let moveRequests = 0;
      await page.route('**/api/pages/*/move', (route) => {
        moveRequests++;
        return route.continue();
      });

      await dragOntoAndPause(page, draggedRow, targetRow);

      // Mid-drag: the hover feedback fires even though the post-drop alert
      // (step 2.2's dead-code removal) no longer does.
      await expect(targetRow).toHaveClass(/drop-invalid/);
      await expect(targetRow.getByRole('img', { name: 'Move not allowed' })).toBeVisible();

      await page.mouse.up();

      // No dialog to dismiss (the drop is silently blocked) and no move
      // request ever fires.
      await page.waitForTimeout(300);
      expect(moveRequests).toBe(0);

      // Dragged page is still where it started — a Root child, not
      // reparented under Target (which would bump its indent to level 2).
      await expect(draggedRow).toBeVisible();
      await expect(draggedRow).toHaveCSS('padding-left', '24px');
      // Target never gained a child, so it never grew a chevron toggle.
      await expect(targetRow.locator('button.chevron')).toHaveCount(0);

      // Persists — reload and confirm Dragged is still a direct Root child.
      await page.reload();
      await rootRow.getByRole('button', { name: 'Expand' }).click();
      await expect(page.getByRole('treeitem', { name: draggedTitle })).toHaveCSS('padding-left', '24px');
    } finally {
      await deletePageType(request, targetTypeGuid);
      await deletePageType(request, draggedTypeGuid);
    }
  });
});
