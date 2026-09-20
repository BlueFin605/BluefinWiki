import { test, expect } from '../fixtures/page-tree';

test.describe('Renaming a page', () => {
  test('renaming the open page updates the tree row immediately and persists after reload', async ({
    page,
    pageTree,
  }) => {
    await page.goto(`/pages/${pageTree.childGuid}`);

    const oldName = `E2E-${pageTree.runId} Child`;
    const newName = `E2E-${pageTree.runId} Child Renamed`;

    // The tree does not auto-expand ancestors of the active page (by design) —
    // expand Root to reveal Child.
    await page
      .getByRole('treeitem', { name: `${pageTree.runId} Root` })
      .getByRole('button', { name: 'Expand' })
      .click();

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

    // The page-detail header, by contrast, does NOT pick up an external
    // rename of the page it currently has open — `page-detail.ts` hydrates
    // its editable `metadata` (which the header title reads) only once per
    // guid, so autosave/dirty-tracking never gets clobbered by an unrelated
    // refetch. A manual Refresh (or reload) is required. This is a real,
    // separate UX gap from the tree-collapse bug above, left as-is here.
    await expect(page.locator('.page-detail .bar .title')).toHaveText(oldName);

    await page.reload();
    await expect(page.locator('.page-detail .bar .title')).toHaveText(newName);
    // A reload resets local tree UI state too — re-expand Root to check the row.
    await page
      .getByRole('treeitem', { name: `${pageTree.runId} Root` })
      .getByRole('button', { name: 'Expand' })
      .click();
    await expect(page.getByRole('treeitem', { name: newName })).toBeVisible();
  });

  test('renaming rejects a too-short title and keeps the original name', async ({ page, pageTree }) => {
    const oldName = `E2E-${pageTree.runId} Grandchild`;
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await page
      .getByRole('treeitem', { name: `${pageTree.runId} Root` })
      .getByRole('button', { name: 'Expand' })
      .click();
    await page
      .getByRole('treeitem', { name: `${pageTree.runId} Child` })
      .getByRole('button', { name: 'Expand' })
      .click();

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
