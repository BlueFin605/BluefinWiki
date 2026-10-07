import { test, expect, createPage } from '../fixtures/page-tree';
import { expandRow } from './helpers';

test.describe('Renaming a page', () => {
  test('renaming the open page updates the tree row immediately and persists after reload', async ({
    page,
    pageTree,
    request,
  }) => {
    // A dedicated page, not the shared `pageTree.childGuid` — this test
    // permanently renames whatever page it targets, and `childGuid` is a
    // worker-scoped fixture other spec files in this worker rely on for its
    // original, stable title (toc-breadcrumbs.spec.ts's item 26 matches it
    // with `exact: true` and broke when this test renamed it in place).
    const oldName = `E2E-${pageTree.runId} Rename Target`;
    const newName = `E2E-${pageTree.runId} Rename Target Renamed`;
    const targetGuid = await createPage(request, oldName, { parentGuid: pageTree.rootGuid });

    await page.goto(`/pages/${targetGuid}`);

    // The tree does not auto-expand ancestors of the active page (by design) —
    // expand Root to reveal Child.
    await expandRow(page.getByRole('treeitem', { name: `${pageTree.runId} Root` }));

    await page.getByRole('treeitem', { name: oldName }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename' }).click();

    const dialog = page.getByRole('dialog', { name: 'Rename page' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByLabel('Page title');
    await expect(input).toHaveValue(oldName);
    await input.fill(newName);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    // The tree row must reflect the rename immediately, with no manual
    // reload — this used to collapse the WHOLE tree instead (Angular's
    // resource() has no retained-value API, so the coarse `children:any`
    // invalidation this rename bumps put every children-resource in the app
    // back into 'loading', unmounting every wiki-page-tree-item and resetting
    // every row's own expand state). Fixed via a retained linkedSignal in
    // page-tree.ts / page-tree-item.ts.
    await expect(page.getByRole('treeitem', { name: newName })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: oldName, exact: true })).toHaveCount(0);

    // The open page-detail header picks up the rename too: a clean page
    // re-syncs its working copy when the page re-resolves (ticket 1d01bb06),
    // so no manual Refresh or reload is needed.
    await expect(page.locator('.page-detail .bar .title')).toHaveText(newName);

    await page.reload();
    await expect(page.locator('.page-detail .bar .title')).toHaveText(newName);
    // A reload resets local tree UI state too — re-expand Root to check the row.
    await expandRow(page.getByRole('treeitem', { name: `${pageTree.runId} Root` }));
    await expect(page.getByRole('treeitem', { name: newName })).toBeVisible();
  });

  test('renaming rejects a too-short title and keeps the original name', async ({ page, pageTree }) => {
    const oldName = `E2E-${pageTree.runId} Grandchild`;
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await expandRow(page.getByRole('treeitem', { name: `${pageTree.runId} Root` }));
    await expandRow(page.getByRole('treeitem', { name: `${pageTree.runId} Child` }));

    await page.getByRole('treeitem', { name: oldName }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename' }).click();

    const dialog = page.getByRole('dialog', { name: 'Rename page' });
    await dialog.getByLabel('Page title').fill('ab');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog.getByText('Title must be at least 3 characters')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('treeitem', { name: oldName })).toBeVisible();
  });
});
