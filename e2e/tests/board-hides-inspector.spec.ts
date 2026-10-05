import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { toggleInspector, inspector } from './helpers';

test.describe('Board view hides the inspector', () => {
  test('desktop: switching to Board hides the open inspector; Content and a reload restore it', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Hide Inspector Card Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Hide Inspector Parent`, {
      parentGuid: pageTree.rootGuid,
    });
    await updatePage(request, parentGuid, {
      boardConfig: { targetTypeGuid: typeGuid, defaultView: 'content' },
    });
    await createPage(request, `${prefix} Hide Inspector Card`, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });

    try {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/pages/${parentGuid}`);

      await toggleInspector(page);
      await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);

      await page.getByRole('radio', { name: 'Board' }).click();
      await expect(page.locator('wiki-board-column').first()).toBeVisible();
      await expect(inspector(page)).not.toHaveClass(/mat-drawer-opened/);

      await page.getByRole('radio', { name: 'Content' }).click();
      await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);

      // The preference survived the board round-trip.
      await page.reload();
      await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
