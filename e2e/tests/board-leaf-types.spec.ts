import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { allowChildTypes, createPageType, deletePageType } from '../fixtures/page-types';

const STATE = [{ name: 'state', type: 'string' as const, required: false }];

// Pages are removed recursively by the worker-scoped pageTree fixture (they
// live under pageTree.rootGuid); the page types are created here, so they are
// deleted here in `finally`.
test.describe('Board leaf types', () => {
  test('a leaf-mode board collects Task and Bug descendants but not their Story', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const created: string[] = [];
    try {
      const taskType = await createPageType(request, `${prefix} LT Task`, { properties: STATE });
      created.push(taskType);
      const bugType = await createPageType(request, `${prefix} LT Bug`, { properties: STATE });
      created.push(bugType);
      const storyType = await createPageType(request, `${prefix} LT Story`, { properties: STATE });
      created.push(storyType);
      await allowChildTypes(request, storyType, [taskType, bugType]);

      const parentGuid = await createPage(request, `${prefix} LT Board`, { parentGuid: pageTree.rootGuid });
      await updatePage(request, parentGuid, { boardConfig: { leafTypes: true, depth: 3, defaultView: 'board' } });
      const ready = { state: { type: 'string' as const, value: 'Ready' } };
      const storyGuid = await createPage(request, `${prefix} LT Story Page`, {
        parentGuid,
        pageType: storyType,
        properties: ready,
      });
      await createPage(request, `${prefix} LT Task Page`, {
        parentGuid: storyGuid,
        pageType: taskType,
        properties: ready,
      });
      await createPage(request, `${prefix} LT Bug Page`, {
        parentGuid: storyGuid,
        pageType: bugType,
        properties: ready,
      });

      await page.goto(`/pages/${parentGuid}`);
      const readyColumn = page.locator('wiki-board-column', { hasText: 'Ready' });
      await expect(readyColumn.getByRole('button', { name: `${prefix} LT Task Page` })).toBeVisible();
      await expect(readyColumn.getByRole('button', { name: `${prefix} LT Bug Page` })).toBeVisible();
      await expect(page.getByRole('button', { name: `${prefix} LT Story Page` })).toHaveCount(0);
    } finally {
      for (const t of created) await deletePageType(request, t);
    }
  });
});
