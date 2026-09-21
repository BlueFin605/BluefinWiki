import { test, expect, createPage, deletePageRecursive } from '../fixtures/page-tree';
import { createPageType, deletePageType, allowChildTypes } from '../fixtures/page-types';
import { dragToRowZone, dragBeforeAdjacentSibling } from './helpers';

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

      await dragToRowZone(page, draggedRow, targetRow, 'onto', { release: false });

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

  test('dragging a page before a sibling under a type-disallowed parent (cross-parent) shows the hover warning and is silently blocked', async ({
    page,
    pageTree,
    request,
  }) => {
    // Finding I2 (fix-wave review, 2026-09-21): `pages-view.onTreeDrop`'s
    // cross-parent before/after re-check used to `window.alert` here; it was
    // dead code for the same reason `page-tree-item.onDrop`'s `onto` alert
    // was (task 2b) — `enterPredicate` is zone-aware and already refuses
    // entry into a disallowed target for `before`/`after`, so the target row
    // never joins the drop list and never triggers a CDK sort-preview
    // relocation. That means, like the `onto` case above, a single
    // pre-computed drag point (`dragToRowZone`) is sufficient — no adjacent-
    // sibling chase technique needed.
    // Distinct wording, not reused anywhere else in e2e/tests/: the
    // worker-scoped `pageTree` fixture (and its `runId`-derived prefix) can
    // be shared across MULTIPLE test files within one worker process (not
    // just repeats of this file), and no test here deletes every page it
    // creates (some only delete their page types) — reusing a title already
    // used elsewhere (even "Typed Parent" / "Dragged", each already used by
    // another spec file) collided under full-suite parallel runs, producing
    // two same-named tree rows and a Playwright strict-mode violation. Grep
    // e2e/tests/ for a candidate title before reusing one here.
    const prefix = `E2E-${pageTree.runId}`;
    const targetParentTypeName = `${prefix} CrossDrop Parent Type`;
    const draggedTypeName = `${prefix} CrossDrop Mover Type`;
    const targetParentTypeGuid = await createPageType(request, targetParentTypeName);
    const draggedTypeGuid = await createPageType(request, draggedTypeName);
    // Target Parent's type accepts only its own type as a child — the mover's
    // type is not in that list, so a cross-parent before/after drop under it
    // is rejected by `checkSiblingDropAllowed`.
    await allowChildTypes(request, targetParentTypeGuid, [targetParentTypeGuid]);

    const targetParentTitle = `${prefix} CrossDrop Parent`;
    const targetSiblingTitle = `${prefix} CrossDrop Sibling`;
    const draggedTitle = `${prefix} CrossDrop Mover`;
    const targetParentGuid = await createPage(request, targetParentTitle, {
      parentGuid: pageTree.rootGuid,
      pageType: targetParentTypeGuid,
    });
    await createPage(request, targetSiblingTitle, {
      parentGuid: targetParentGuid,
      pageType: targetParentTypeGuid,
    });
    const draggedGuid = await createPage(request, draggedTitle, {
      parentGuid: pageTree.rootGuid,
      pageType: draggedTypeGuid,
    });

    try {
      await page.goto(`/pages/${pageTree.rootGuid}`);
      const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
      await rootRow.getByRole('button', { name: 'Expand' }).click();

      const targetParentRow = page.getByRole('treeitem', { name: targetParentTitle });
      const draggedRow = page.getByRole('treeitem', { name: draggedTitle });
      await expect(targetParentRow).toBeVisible();
      await expect(draggedRow).toBeVisible();
      // Both are direct children of Root (level 1): indent = 1*16+8 = 24px.
      await expect(draggedRow).toHaveCSS('padding-left', '24px');
      await targetParentRow.getByRole('button', { name: 'Expand' }).click();

      const targetSiblingRow = page.getByRole('treeitem', { name: targetSiblingTitle });
      await expect(targetSiblingRow).toBeVisible();

      let moveRequests = 0;
      let reorderRequests = 0;
      await page.route('**/api/pages/*/move', (route) => {
        moveRequests++;
        return route.continue();
      });
      await page.route('**/api/pages/reorder', (route) => {
        reorderRequests++;
        return route.continue();
      });

      // Drop Dragged into the `before` zone of Target Sibling — a cross-parent
      // move that would join Dragged under Target Parent (disallowed by type).
      await dragToRowZone(page, draggedRow, targetSiblingRow, 'before', { release: false });

      // Mid-drag: the hover feedback fires even though the on-drop re-check
      // (this fix wave's dead-code removal) no longer alerts.
      await expect(targetSiblingRow).toHaveClass(/drop-invalid/);
      await expect(targetSiblingRow.getByRole('img', { name: 'Move not allowed' })).toBeVisible();

      await page.mouse.up();

      // No dialog to dismiss (the drop is silently blocked) and neither a
      // move nor a reorder request ever fires.
      await page.waitForTimeout(300);
      expect(moveRequests).toBe(0);
      expect(reorderRequests).toBe(0);

      // Dragged page is still where it started — a direct Root child.
      await expect(draggedRow).toBeVisible();
      await expect(draggedRow).toHaveCSS('padding-left', '24px');

      // Persists — reload and confirm Dragged is still a direct Root child.
      await page.reload();
      await rootRow.getByRole('button', { name: 'Expand' }).click();
      await expect(page.getByRole('treeitem', { name: draggedTitle })).toHaveCSS('padding-left', '24px');
    } finally {
      // Delete the pages themselves (not just their types) — this file's
      // worker-scoped `pageTree` fixture is shared across every test in a
      // run, so a leftover page here can collide with a later test's own
      // same-worker page by title (see the naming note above).
      await deletePageRecursive(request, targetParentGuid);
      await deletePageRecursive(request, draggedGuid);
      await deletePageType(request, targetParentTypeGuid);
      await deletePageType(request, draggedTypeGuid);
    }
  });
});
