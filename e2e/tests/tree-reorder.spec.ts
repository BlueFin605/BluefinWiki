import { test, expect, createPage } from '../fixtures/page-tree';

test.describe('Reordering tree children', () => {
  test('Sort children A-Z / Z-A reorders siblings and the tree reflects it immediately', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const zebraTitle = `${prefix} Zebra`;
    const mangoTitle = `${prefix} Mango`;
    const appleTitle = `${prefix} Apple`;

    // Created out of alphabetical order under the same parent as the
    // fixture's own children, so a real sort has visible work to do.
    await createPage(request, zebraTitle, { parentGuid: pageTree.rootGuid });
    await createPage(request, mangoTitle, { parentGuid: pageTree.rootGuid });
    await createPage(request, appleTitle, { parentGuid: pageTree.rootGuid });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
    await rootRow.getByRole('button', { name: 'Expand' }).click();
    await expect(page.getByRole('treeitem', { name: zebraTitle })).toBeVisible();

    const orderOf = async (): Promise<string[]> => {
      const all = await page.locator('[role="treeitem"] .page-title').allTextContents();
      return all.filter((t) => t === zebraTitle || t === mangoTitle || t === appleTitle);
    };

    await rootRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Sort children A-Z' }).click();

    // Reflected immediately — no reload — and Root must stay expanded (the
    // reorder bumps the same coarse `children:any` tag a rename does; this
    // exercises the tree-collapse fix from page-tree.ts/page-tree-item.ts).
    await expect.poll(orderOf).toEqual([appleTitle, mangoTitle, zebraTitle]);
    await expect(rootRow).toHaveAttribute('aria-expanded', 'true');

    await rootRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Sort children Z-A' }).click();
    await expect.poll(orderOf).toEqual([zebraTitle, mangoTitle, appleTitle]);

    // Persists — a real reorder, not just an optimistic local splice.
    await page.reload();
    await rootRow.getByRole('button', { name: 'Expand' }).click();
    await expect.poll(orderOf).toEqual([zebraTitle, mangoTitle, appleTitle]);
  });
});
