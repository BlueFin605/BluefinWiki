import { test, expect } from '../fixtures/page-tree';

test.describe('Tree keyboard navigation', () => {
  test('ArrowRight/ArrowLeft expand and collapse a row', async ({ page, pageTree }) => {
    await page.goto(`/pages/${pageTree.rootGuid}`);
    const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
    await expect(rootRow).toHaveAttribute('aria-expanded', 'false');

    await rootRow.focus();
    await rootRow.press('ArrowRight');
    await expect(rootRow).toHaveAttribute('aria-expanded', 'true');

    await rootRow.press('ArrowLeft');
    await expect(rootRow).toHaveAttribute('aria-expanded', 'false');
  });

  test('creating a child page auto-expands its parent', async ({ page, pageTree }) => {
    await page.goto(`/pages/${pageTree.rootGuid}`);
    const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
    await expect(rootRow).toHaveAttribute('aria-expanded', 'false');

    // "New child page" via the root row's context menu (see
    // page-context-menu.ts, and page-create-edit-save.spec.ts:12 for this
    // same verbatim menuitem name in an already-passing sibling spec).
    await rootRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'New child page' }).click();

    const dialog = page.getByRole('dialog', { name: 'New page' });
    await dialog.getByLabel('Title').fill(`${pageTree.runId} Auto-Expand Child`);
    await dialog.getByRole('button', { name: 'Create' }).click();

    // NewPageModal navigates to /pages/:guid/edit on success (pages-view.ts's
    // openNewPageModal), which also force-expands the parent
    // (page-tree-item.ts:330-341's expandGuid effect) so the new child is
    // visible in context.
    await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+\/edit$/);
    await expect(rootRow).toHaveAttribute('aria-expanded', 'true');
  });
});
