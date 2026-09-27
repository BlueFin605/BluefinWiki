import { test, expect } from '@playwright/test';

const ROUTES = ['/settings', '/admin/users', '/admin/invitations', '/admin/page-types', '/admin/rebuild-page-index', '/profile'];

test.describe('Admin/profile back navigation', () => {
  for (const route of ROUTES) {
    test(`"${route}" has a working back-to-pages affordance`, async ({ page }) => {
      await page.goto(route);
      const back = page.getByRole('button', { name: 'Back to pages' });
      await expect(back).toBeVisible();
      await back.click();
      await expect(page).toHaveURL(/\/pages$/);
    });
  }
});
