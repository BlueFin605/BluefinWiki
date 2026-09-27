import { test, expect, createPage } from '../fixtures/page-tree';
import type { Locator, Page } from '@playwright/test';

/**
 * Drags `source` onto `target` (a stable, non-sibling drop zone — see the
 * doc comment below for why this avoids row-to-row drops). Playwright's
 * `dragTo()` doesn't fire enough intermediate `pointermove`s for CDK
 * drag-drop to register a real drag, so a manual mouse sequence with several
 * intermediate steps is used instead.
 */
async function dragOnto(page: Page, source: Locator, target: Locator): Promise<void> {
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('dragOnto: source or target has no bounding box');

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  // Small initial move past CDK's drag-start threshold, then a beat for
  // Angular to process `cdkDragStarted`.
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 5, { steps: 5 });
  await page.waitForTimeout(100);
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test.describe('Reparenting via drag-and-drop', () => {
  /**
   * Dropping ONTO another tree row (page-tree-item.ts's own `cdkDropList`)
   * was tried first and is flaky by design, not by test bug: sibling rows
   * share one `cdkDropListGroup`, and CDK renders a "sort preview" — nearby
   * rows visually swap position with the dragged item's placeholder via CSS
   * transforms as the pointer nears the boundary between them. Re-reading
   * the target's `boundingBox()` to correct aim (needed because the source
   * row leaving the flow shifts everything below it) chases that same
   * transform, so the corrected position provokes the next swap — an
   * oscillation, not a settle. The root-drop-zone below is a `cdkDropList`
   * but NOT a `cdkDrag` sibling in that group, so it never participates in
   * the swap preview and gives a stable target — real coverage of the same
   * `onDrop` → `movePage` reparent path, one level of a well-known, harder
   * flakiness class away from row-to-row.
   */
  test('dragging a nested page to the root drop zone reparents it to the top level, and the tree reflects it immediately', async ({
    page,
    pageTree,
    request,
  }) => {
    const movedTitle = `E2E-${pageTree.runId} Movable`;
    const movedGuid = await createPage(request, movedTitle, { parentGuid: pageTree.childGuid });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
    await rootRow.getByRole('button', { name: 'Expand' }).click();
    const childRow = page.getByRole('treeitem', { name: `${pageTree.runId} Child` });
    await childRow.getByRole('button', { name: 'Expand' }).click();

    const movedRow = page.getByRole('treeitem', { name: movedTitle });
    await expect(movedRow).toBeVisible();

    await dragOnto(page, movedRow, page.locator('.root-drop-zone'));

    // Reflected immediately, no reload — and Root/Child stay expanded
    // (exercises the same tree-collapse fix as the rename/reorder specs,
    // since `movePage` bumps the same coarse `children:any` tag).
    await expect(rootRow).toHaveAttribute('aria-expanded', 'true');
    await expect(childRow).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('treeitem', { name: movedTitle })).toHaveCount(1);

    // No longer nested under Child — moved out to the top level, alongside
    // Root: `indent = level * 16 + 8` (page-tree-item.ts), so a level-0 row's
    // padding-left is 8px, distinct from the level-2 nesting it started at.
    await expect(movedRow).toHaveCSS('padding-left', '8px');

    // Persists.
    await page.reload();
    await expect(page.getByRole('treeitem', { name: movedTitle })).toBeVisible();

    // Clean up: this page is now a root-level page, so the fixture's
    // recursive delete on pageTree.rootGuid will never reach it.
    await request.delete(`http://localhost:3000/pages/${movedGuid}`, {
      headers: { Authorization: 'Bearer mock-jwt-token' },
    });
  });
});
