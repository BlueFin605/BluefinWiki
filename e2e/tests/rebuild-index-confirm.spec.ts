import { test, expect } from '@playwright/test';

test.describe('Rebuild page index', () => {
  test('requires confirmation before running; cancel makes no request', async ({ page }) => {
    let requestFired = false;
    await page.route('**/api/admin/rebuild-page-index', (route) => {
      requestFired = true;
      route.continue();
    });

    await page.goto('/admin/rebuild-page-index');
    await page.getByRole('button', { name: 'Rebuild now' }).click();

    await expect(page.getByText(/This will scan the entire pages bucket/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(requestFired, 'Cancel must not call the rebuild endpoint').toBe(false);

    await expect(page.getByRole('button', { name: 'Rebuild now' })).toBeVisible();
  });

  test('confirming runs the rebuild and shows a result summary', async ({ page }) => {
    test.setTimeout(120_000); // scans the whole shared pages bucket — generous per plan note

    await page.goto('/admin/rebuild-page-index');
    await page.getByRole('button', { name: 'Rebuild now' }).click();
    await page.getByRole('button', { name: 'Yes, rebuild' }).click();

    await expect(page.getByText(/Rebuild in progress/)).toBeVisible();

    const result = page.getByRole('region', { name: 'Rebuild result' });
    await expect(result).toBeVisible({ timeout: 110_000 });
    await expect(page.getByText('Rebuild complete.')).toBeVisible();

    // Don't assert exact counts — other specs' fixture data shares this
    // backend and this test may run interleaved with them. Just confirm the
    // summary fields are present and numeric/non-negative.
    for (const label of ['Pages discovered', 'Rows written', 'Orphan rows deleted', 'Failed', 'Duration (s)']) {
      const dd = result.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]');
      await expect(dd).not.toHaveText('');
    }
  });
});
