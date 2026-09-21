import { test, expect, createPage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';

test.describe('Board eligibility without explicit config', () => {
  test('a page whose children have a state-bearing type is board-eligible with no boardConfig', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Auto-Eligible Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });

    const parentGuid = await createPage(request, `${prefix} Auto-Eligible Parent`, { parentGuid: pageTree.rootGuid });
    await createPage(request, `${prefix} Child With State`, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);
      // The Content|Board toggle is a mat-button-toggle-group in single-select
      // mode, which Angular Material renders with role="radio" per toggle
      // (confirmed against frontend/src/app/features/pages/page-detail.ts and
      // its own spec's `getByRole('radio', { name: 'Board' })` usage).
      const boardToggle = page.getByRole('radio', { name: 'Board' });
      await expect(boardToggle).toBeVisible(); // the toggle only renders at all when boardEligible() is true
      await boardToggle.click();
      await expect(page.locator('wiki-board-column', { hasText: 'To Do' })).toBeVisible();
    } finally {
      await deletePageType(request, typeGuid);
    }
  });

  test('a state-schema type whose child has no value set does NOT make the parent eligible', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Unset-State Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });

    const parentGuid = await createPage(request, `${prefix} Not Eligible Parent`, { parentGuid: pageTree.rootGuid });
    await createPage(request, `${prefix} Child Without State Value`, { parentGuid, pageType: typeGuid });

    try {
      await page.goto(`/pages/${parentGuid}`);
      await expect(page.getByRole('radio', { name: 'Board' })).toHaveCount(0);
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
