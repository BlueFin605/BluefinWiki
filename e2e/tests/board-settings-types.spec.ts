import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';

// Both tests below depend on the *system-wide* list of "boardable"
// (state-bearing) page types -- `boardableTypes()` filters every page type
// the backend knows about, not just ones scoped to this file's run prefix
// (see `board-settings-panel.ts`'s `boardableTypeOptions` and
// `page-detail.ts`'s `openBoardSettings()`, which reads the full
// `pageTypesResource()`). Test 1 creates a boardable type; test 2 asserts
// none exist at all. Under `fullyParallel`, Playwright may otherwise run
// both tests concurrently in different workers -- serialize so test 1's
// `finally` cleanup completes before test 2 runs.
test.describe.configure({ mode: 'serial' });

test.describe('Board Settings — boardable type filtering', () => {
  test('the Target type select lists only state-bearing types', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const boardableGuid = await createPageType(request, `${prefix} Boardable Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const nonBoardableGuid = await createPageType(request, `${prefix} Non-Boardable Type`, {
      properties: [{ name: 'note', type: 'string', required: false }],
    });

    const parentGuid = await createPage(request, `${prefix} Settings Parent`, { parentGuid: pageTree.rootGuid });
    // `targetTypeGuid` + `defaultView: 'board'` together land the page
    // directly in board mode on load -- confirmed against page-detail.ts's
    // viewMode-sync effect (`if (cfg?.defaultView === 'board' && eligible)
    // this._viewMode.set('board')`), and `isBoardEligible` short-circuits to
    // eligible whenever `targetTypeGuid` is truthy, with no manual
    // Content|Board toggle click required. Same pattern already verified by
    // board-view-functional.spec.ts and board-drag-columns.spec.ts.
    await updatePage(request, parentGuid, {
      boardConfig: { targetTypeGuid: boardableGuid, defaultView: 'board' },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);
      // The "Board settings" button only renders once viewMode() === 'board'
      // (page-detail.ts template), which the defaultView effect above already
      // satisfies -- no toggle click needed before this.
      await page.getByRole('button', { name: 'Board settings' }).click();

      await page.getByLabel('Target type').click();
      await expect(page.getByRole('option', { name: new RegExp(`${prefix} Boardable Type`) })).toBeVisible();
      await expect(page.getByRole('option', { name: new RegExp(`${prefix} Non-Boardable Type`) })).toHaveCount(0);
    } finally {
      await deletePageType(request, boardableGuid);
      await deletePageType(request, nonBoardableGuid);
    }
  });

  test('with no boardable types at all, the select is disabled with an explanatory hint', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    // Establish board eligibility via a real boardable type's guid, then
    // delete that type before navigating -- deleting a page type does not
    // touch pages that already reference it (see
    // backend/src/page-types/page-types-delete.ts: "Does not affect pages
    // already using this type"), so `targetTypeGuid` stays set and the page
    // still opens in board mode, while the system-wide boardable-types list
    // is genuinely empty by the time the dialog reads it. This also matches
    // a real scenario: a board config can outlive its target type.
    const typeGuid = await createPageType(request, `${prefix} Temp Boardable Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} No Boardable Types Parent`, {
      parentGuid: pageTree.rootGuid,
    });
    await updatePage(request, parentGuid, {
      boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' },
    });
    await deletePageType(request, typeGuid);

    await page.goto(`/pages/${parentGuid}`);
    await page.getByRole('button', { name: 'Board settings' }).click();
    await expect(page.getByText(/No page types define a "state" property/)).toBeVisible();
    await expect(page.getByLabel('Target type')).toBeDisabled();
  });
});
