import { test, expect } from '@playwright/test';

test.describe('Profile page', () => {
  test('display name can be changed and saved', async ({ page }) => {
    await page.goto('/profile');
    const input = page.getByLabel('Display Name');
    const newName = `E2E Admin ${Date.now()}`;
    await input.fill(newName);

    const save = page.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByText('Profile updated.')).toBeVisible();
  });

  test('change-password sends the access token via X-Access-Token (regression: fe4b1f9)', async ({ page }) => {
    await page.goto('/profile');

    let capturedHeader: string | undefined;
    await page.route('**/api/auth/change-password', async (route) => {
      capturedHeader = route.request().headers()['x-access-token'];
      // Can't get a real 200 locally (see plan comment) — fulfill success so
      // the UI's own success path is still exercised end-to-end.
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.getByLabel('Current Password').fill('CurrentPass123!');
    await page.getByLabel('New Password').fill('NewPass456!');
    await page.getByLabel('Confirm Password').fill('NewPass456!');

    const submit = page.getByRole('button', { name: 'Change Password' });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText('Password changed.')).toBeVisible();
    expect(capturedHeader, 'X-Access-Token header must be present and non-empty').toBeTruthy();

    // Fields clear on success.
    await expect(page.getByLabel('Current Password')).toHaveValue('');
  });
});
