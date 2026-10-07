import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { openSearch } from './helpers';

// At phone width (390px) dialogs must fit the viewport: nothing clipped on
// either side, no horizontal scroll inside the surface.
test.describe('Dialogs at 390px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('search dialog fits: close button and scope toggles are on screen', async ({ page, pageTree }) => {
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await openSearch(page);
    const dialog = page.getByRole('dialog', { name: 'Search wiki' });
    await expect(dialog).toBeVisible();

    for (const el of [
      dialog.getByRole('button', { name: /close/i }),
      dialog.getByRole('radio', { name: 'Content' }),
      dialog.getByRole('radio', { name: '50' }),
    ]) {
      const box = (await el.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('Board settings fits inside the viewport', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Narrow Card Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Narrow Parent`, { parentGuid: pageTree.rootGuid });
    await updatePage(request, parentGuid, { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } });
    try {
      await page.goto(`/pages/${parentGuid}`);
      await page.getByRole('button', { name: 'Board settings' }).click();
      const surface = page.locator('.mat-mdc-dialog-surface');
      await expect(surface).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Board settings' })).toBeInViewport({ ratio: 1 });

      const box = (await surface.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      const overflow = await surface.evaluate((el) => {
        const content = el.querySelector('.mat-mdc-dialog-content') as HTMLElement;
        return content.scrollWidth - content.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
      for (const name of ['Direct children', 'Leaf types', 'Specific types']) {
        const t = (await page.getByRole('radio', { name }).boundingBox())!;
        expect(t.x + t.width).toBeLessThanOrEqual(box.x + box.width);
      }
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
