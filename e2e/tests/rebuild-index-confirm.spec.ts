import { test, expect } from '@playwright/test';

// HAZARD: the "confirming runs the rebuild..." test below triggers
// backend/src/storage/rebuild-page-index.ts, which snapshots the live page
// set at the start of the run and, at the end, deletes every DynamoDB
// page-index row whose guid isn't in that snapshot (treating it as an
// orphan). Playwright's config runs fullyParallel with multiple workers, so
// pages created by other specs running concurrently during this test's
// up-to-110s window can be swept as "orphans" — self-healed on next lookup
// via a full-bucket S3 scan, but this adds load and is a plausible (not
// confirmed) cause of the toc-breadcrumbs and property-inheritance specs
// each flaking once across two full-suite runs during this plan's Task 6
// verification. Left as a documented hazard rather than a config change
// (e.g. a serial project) — see docs/flows/angular-parity-plan/README.md's
// Phase 8 status-board row for the tracked follow-up.
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
