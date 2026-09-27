import { test, expect } from '../fixtures/page-tree';

test.describe('Creating, editing and saving a page', () => {
  test('New child page creates a page, lands in the editor, and its content can be edited and saved', async ({
    page,
    pageTree,
  }) => {
    await page.goto(`/pages/${pageTree.rootGuid}`);

    // "New child page" via the root row's context menu.
    await page.getByRole('treeitem', { name: `${pageTree.runId} Root` }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'New child page' }).click();

    const title = `${pageTree.runId} Created Page`;
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create' }).click();

    // NewPageModal navigates to /pages/:guid/edit on success.
    await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+\/edit$/);
    await expect(page.getByRole('radio', { name: 'Edit' })).toHaveAttribute('aria-checked', 'true');

    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('Start writing');

    const marker = `E2E edit marker ${pageTree.runId}`;
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type(marker);

    await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'unsaved');
    await page.getByRole('button', { name: 'Save' }).click();

    // Save navigates edit -> view on success (page-detail.ts's save()); the UI
    // must actually land there and render the saved content, not just report success.
    await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+$/, { timeout: 10_000 });
    await expect(page.getByText(marker)).toBeVisible();

    // Reload from the server (not just the client route) and confirm the edit
    // truly persisted, both in the rendered view and back in the editor.
    await page.reload();
    await expect(page.getByText(marker)).toBeVisible();

    await page.getByRole('radio', { name: 'Edit', exact: true }).click();
    await expect(page.locator('.cm-content')).toContainText(marker);
    await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'saved');
  });

  test('a root-level page created via "New page" appears in the tree', async ({ page, pageTree }) => {
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await page.getByRole('button', { name: 'New page', exact: true }).click();
    const title = `${pageTree.runId} Root-level Page`;
    await page.getByLabel('Title').fill(title);
    await expect(page.getByText('Parent:').locator('..')).toContainText('Root');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+\/edit$/);
    const guidMatch = page.url().match(/\/pages\/([0-9a-f-]+)\/edit$/);
    expect(guidMatch).not.toBeNull();

    // Clean up immediately — this page is NOT under pageTree.rootGuid, so the
    // fixture's recursive delete on the tree root would never reach it.
    const created = guidMatch![1];
    await page.request.delete(`http://localhost:3000/pages/${created}`, {
      headers: { Authorization: 'Bearer mock-jwt-token' },
    });
  });
});
