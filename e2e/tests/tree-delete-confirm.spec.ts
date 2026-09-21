import { test, expect, createPage } from '../fixtures/page-tree';

/**
 * Delete-confirmation coverage (Phase 2 tree-CRUD, item 7).
 *
 * Selectors verified against the live source, not guessed:
 * - Context-menu item: `page-context-menu.ts`'s "Delete" button renders
 *   `<span>Delete</span>` (gated behind `canDelete()`, i.e. an Admin user —
 *   the mock e2e auth user resolves to Admin per Phase 8's investigation).
 * - Dialog: `pages-view.ts`'s `onDeleteRequested` opens the shared
 *   `ConfirmDialog` with `title: 'Delete page'`, `confirmLabel: 'Delete'`,
 *   `cancelLabel` defaulting to `'Cancel'`, and the exact leaf / has-children
 *   copy asserted below (matches `pages-view.spec.ts`'s own assertions on the
 *   same strings).
 * - Error path: a failed `deletePage` is caught and surfaced via
 *   `this.snack.open(this.deleteErrorMessage(err), 'Dismiss', ...)`, where
 *   `deleteErrorMessage` reads `err.error?.message` first — i.e. the JSON
 *   `{ message }` body of a failed HTTP response, verbatim.
 *
 * As in `page-rename.spec.ts` / `tree-drag-reorder.spec.ts`, the tree does
 * NOT auto-expand ancestors of the active page: Root's own row must be
 * expanded to reveal a child created under it.
 */
test.describe('Delete confirmation', () => {
  test('deleting a leaf page shows the leaf copy', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const leafTitle = `${prefix} Leaf To Delete`;
    await createPage(request, leafTitle, { parentGuid: pageTree.rootGuid });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    await page
      .getByRole('treeitem', { name: `${pageTree.runId} Root` })
      .getByRole('button', { name: 'Expand' })
      .click();

    const leafRow = page.getByRole('treeitem', { name: leafTitle });
    await leafRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete page' });
    await expect(dialog.getByText('Delete this page?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('treeitem', { name: leafTitle })).toBeVisible();
  });

  test('deleting a page with children shows child-aware copy', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const parentTitle = `${prefix} Parent With Child`;
    const parentGuid = await createPage(request, parentTitle, { parentGuid: pageTree.rootGuid });
    await createPage(request, `${prefix} Its Child`, { parentGuid });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    await page
      .getByRole('treeitem', { name: `${pageTree.runId} Root` })
      .getByRole('button', { name: 'Expand' })
      .click();

    const parentRow = page.getByRole('treeitem', { name: parentTitle });
    await parentRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete page' });
    await expect(
      dialog.getByText('Delete this page and all its child pages? This action cannot be undone.'),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('treeitem', { name: parentTitle })).toBeVisible();
  });

  test('a server error on delete is surfaced', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const title = `${prefix} Delete Error Target`;
    await createPage(request, title, { parentGuid: pageTree.rootGuid });

    await page.route('**/api/pages/*', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Simulated delete failure' }),
        });
      }
      return route.continue();
    });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    await page
      .getByRole('treeitem', { name: `${pageTree.runId} Root` })
      .getByRole('button', { name: 'Expand' })
      .click();

    const row = page.getByRole('treeitem', { name: title });
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete page' });
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Simulated delete failure')).toBeVisible();
    await expect(page.getByRole('treeitem', { name: title })).toBeVisible(); // not removed
  });
});
