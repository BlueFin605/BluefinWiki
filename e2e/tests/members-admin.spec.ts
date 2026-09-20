import { test, expect } from '@playwright/test';
import { seedDeletedUser, deleteSeededUser } from '../fixtures/admin-users';
import { routeFailure } from './helpers';

test.describe('Members admin', () => {
  test('Edit is disabled for a deleted user', async ({ page }) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { userId, displayName } = await seedDeletedUser(runId);
    try {
      await page.goto('/admin/users');
      const editBtn = page.getByRole('button', { name: `Edit ${displayName}` });
      await expect(editBtn).toBeVisible();
      await expect(editBtn).toBeDisabled();
    } finally {
      await deleteSeededUser(userId);
    }
  });

  test('a failed member-list load shows Retry, which recovers', async ({ page }) => {
    await routeFailure(page, '**/api/admin/users', 500);
    await page.goto('/admin/users');

    await expect(page.getByText('Failed to load members.')).toBeVisible();
    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible();

    await page.unroute('**/api/admin/users');
    await retry.click();

    await expect(page.getByText('Failed to load members.')).toBeHidden();
  });
});
