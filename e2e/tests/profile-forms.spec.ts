import { test, expect } from '@playwright/test';

test.describe('Profile page', () => {
  test('display name can be changed and persists', async ({ page }) => {
    await page.goto('/profile');
    const input = page.getByLabel('Display Name');
    const newName = `E2E Admin ${Date.now()}`;
    await input.fill(newName);

    const save = page.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByText('Profile updated.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Display Name')).toHaveValue(newName);
  });
});
