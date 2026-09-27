import { test, expect } from '@playwright/test';

test('the app shell loads against the running dev stack', async ({ page }) => {
  await page.goto('/pages');
  await expect(page.getByText('BluefinWiki')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New page' })).toBeVisible();
});
