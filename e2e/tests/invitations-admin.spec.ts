import { test, expect } from '@playwright/test';

test.describe('Invitations admin', () => {
  test('status filter pills switch the list', async ({ page }) => {
    await page.goto('/admin/invitations');
    for (const label of ['All', 'Pending', 'Used', 'Expired', 'Revoked']) {
      // mat-button-toggle-group has no `multiple` attr here, so it's a
      // single-selector group: each toggle's inner <button> renders
      // role="radio" + aria-checked (not aria-pressed) — confirmed against
      // @angular/material/fesm2022/button-toggle.mjs's isSingleSelector()
      // branch and matched by the existing unit test's
      // getByRole('radio', { name: /^pending$/i }) in invitation-management.spec.ts.
      const pill = page.getByRole('radio', { name: label });
      await pill.click();
      // Each click re-triggers GET /api/admin/invitations?status=... — wait
      // for the loading state to clear rather than asserting on timing.
      await expect(pill).toBeChecked();
      await expect(page.getByText('Loading invitations...')).toBeHidden();
    }
  });

  test('creating an invitation shows its code; expiryDays is validated 1-30, default 7', async ({ page }) => {
    await page.goto('/admin/invitations');
    await page.getByRole('button', { name: 'Create invitation' }).click();

    const dialog = page.getByRole('dialog', { name: 'New Invitation' });
    await expect(dialog.getByLabel('Expires (days)')).toHaveValue('7');

    const create = dialog.getByRole('button', { name: 'Create', exact: true });

    await dialog.getByLabel('Expires (days)').fill('0');
    await expect(dialog.getByText('Enter a number of days between 1 and 30.')).toBeVisible();
    await expect(create).toBeDisabled();

    await dialog.getByLabel('Expires (days)').fill('31');
    await expect(dialog.getByText('Enter a number of days between 1 and 30.')).toBeVisible();
    await expect(create).toBeDisabled();

    await dialog.getByLabel('Expires (days)').fill('30');
    await expect(create).toBeEnabled();

    await create.click();
    await expect(page.getByRole('status').filter({ hasText: 'Invitation created:' })).toBeVisible();
  });
});
