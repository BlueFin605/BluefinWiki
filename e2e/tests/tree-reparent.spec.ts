import { test, expect, createPage } from '../fixtures/page-tree';
import type { Locator, Page } from '@playwright/test';
import { dragToRowZone } from './helpers';

// "Immediately" means without a reload, not within the default 5 s: under
// the parallel full run the write behind it can take longer.
const REFLECT_MS = 15_000;

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

/**
 * `padding-left` of every row matching `rows`. After a move, the root list and
 * the old parent's list refetch independently; when the root response lands
 * first the page briefly renders in BOTH places (~100ms), and a strict-mode
 * `toHaveCSS` on the title locator throws on the two matches instead of
 * retrying. Polling this list to `['8px']` waits for the tree to settle.
 */
async function rowIndents(rows: Locator): Promise<string[]> {
  return rows.evaluateAll((els) => els.map((el) => getComputedStyle(el).paddingLeft));
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

    // No longer nested under Child — moved out to the top level, alongside
    // Root: `indent = level * 16 + 8` (page-tree-item.ts), so a level-0 row's
    // padding-left is 8px, distinct from the level-2 nesting it started at.
    // Exactly one row, at the top level (see `rowIndents`).
    await expect.poll(() => rowIndents(movedRow), { timeout: REFLECT_MS }).toEqual(['8px']);

    // Persists.
    await page.reload();
    await expect(page.getByRole('treeitem', { name: movedTitle })).toBeVisible();

    // Clean up: this page is now a root-level page, so the fixture's
    // recursive delete on pageTree.rootGuid will never reach it.
    await request.delete(`http://localhost:3000/pages/${movedGuid}`, {
      headers: { Authorization: 'Bearer mock-jwt-token' },
    });
  });

  /**
   * Regression: a before/after drop on a TOP-LEVEL row used to reparent the
   * page UNDER that row instead of beside it. CDK inserted its drag
   * placeholder (a full-height row clone) into the hovered row's own
   * `cdkDropList`, shoving the row out from under a still pointer; the
   * resulting `pointerleave` nulled the row's `_dropZone` and `onDrop` fell
   * back to `onto`. A single committed move (`dragToRowZone`) — what a user's
   * steady hand does — must now land beside the row, at the root.
   */
  for (const zone of ['before', 'after'] as const) {
    test(`dropping a nested page in the ${zone} zone of a top-level row makes it a root page`, async ({
      page,
      pageTree,
      request,
    }) => {
      const movedTitle = `E2E-${pageTree.runId} TopLevelDrop ${zone}`;
      const movedGuid = await createPage(request, movedTitle, { parentGuid: pageTree.childGuid });

      try {
        // Realtime off: other workers add and delete root pages, and live
        // tree refreshes would shift the rows under the drag, landing the
        // drop on the wrong row. The app's `/ws` is answered here instead.
        await page.routeWebSocket(/\/ws(\?|$)/, () => {});

        await page.goto(`/pages/${pageTree.rootGuid}`);
        const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
        await rootRow.getByRole('button', { name: 'Expand' }).click();
        const childRow = page.getByRole('treeitem', { name: `${pageTree.runId} Child` });
        await childRow.getByRole('button', { name: 'Expand' }).click();
        const movedRow = page.getByRole('treeitem', { name: movedTitle });
        await expect(movedRow).toBeVisible();

        // A before/after drop at the root is move-then-reorder of the ROOT
        // sibling list, which every parallel worker's fixture also creates and
        // deletes pages in. A concurrent change between `onTreeDrop`'s sibling
        // fetch and its reorder makes the backend 400 ("not children of the
        // parent"), and the app's rollback then moves the page home. Stub the
        // reorder so this test pins the reparent-to-root itself (reorder has
        // its own coverage in tree-drag-reorder.spec.ts).
        await page.route('**/api/pages/reorder', (route) =>
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated: 0 }) }),
        );

        const moveRequest = page.waitForRequest(
          (req) => req.url().includes(`/api/pages/${movedGuid}/move`) && req.method() === 'PUT',
        );
        await dragToRowZone(page, movedRow, rootRow, zone);

        expect((await moveRequest).postDataJSON()).toEqual({ newParentGuid: null });
        await expect.poll(() => rowIndents(movedRow), { timeout: REFLECT_MS }).toEqual(['8px']);

        await page.reload();
        await expect(page.getByRole('treeitem', { name: movedTitle })).toHaveCSS('padding-left', '8px');
      } finally {
        await request.delete(`http://localhost:3000/pages/${movedGuid}`, {
          headers: { Authorization: 'Bearer mock-jwt-token' },
        });
      }
    });
  }
});
