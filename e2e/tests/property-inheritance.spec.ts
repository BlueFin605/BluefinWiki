import { test, expect, createPage } from '../fixtures/page-tree';
import { createPageType, deletePageType, allowChildTypes } from '../fixtures/page-types';
import { toggleInspector, inspector } from './helpers';

test.describe('Property inheritance on page creation', () => {
  test('creating a child page under a typed parent copies the parent\'s matching property values', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeName = `${prefix} Feature Type`;
    const typeGuid = await createPageType(request, typeName, {
      properties: [{ name: 'priority', type: 'string', required: false }],
    });
    // Let a "Feature Type" page have another "Feature Type" page as a
    // child — otherwise the New Page modal offers no type at all (real
    // type-constraint enforcement, not a fixture bug).
    await allowChildTypes(request, typeGuid, [typeGuid]);

    const parentTitle = `${prefix} Feature Parent`;
    const parentGuid = await createPage(request, parentTitle, {
      parentGuid: pageTree.rootGuid,
      pageType: typeGuid,
      properties: { priority: { type: 'string', value: 'High' } },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);

      // parentGuid is a child of pageTree.rootGuid, not a root-level page —
      // expand Root to reveal its row (the tree does not auto-expand
      // ancestors of the active page, by design).
      await page
        .getByRole('treeitem', { name: `${pageTree.runId} Root` })
        .getByRole('button', { name: 'Expand' })
        .click();
      await page.getByRole('treeitem', { name: parentTitle }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'New child page' }).click();

      const childTitle = `${prefix} Feature Child`;
      await page.getByLabel('Title').fill(childTitle);
      // Only one type is offered; the parent's own type. New Page modal
      // build-inherited-properties.ts (step 2.6) copies same-name/same-type
      // parent property values into the schema this type selection triggers.
      await page.getByLabel('Page type').click();
      await page.getByRole('option', { name: typeName }).click();
      await page.getByRole('button', { name: 'Create' }).click();

      await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+\/edit$/);

      await toggleInspector(page);
      const priorityField = page.getByLabel('priority', { exact: true });
      await expect(priorityField).toBeVisible();
      await expect(priorityField).toHaveValue('High');

      // Persists — this isn't just the modal's optimistic local state.
      await page.reload();
      // The inspector's open/closed state persists across reload
      // (`inspectorVisible: true`, set by the toggleInspector() above) and
      // reopens on its own once the page's guid/metadata resolve — a
      // check-then-toggle here would race that async gate: reading "closed"
      // before it settles and clicking would flip the persisted state back
      // off just as it resolves open (search-and-global.spec.ts Finding N1).
      // Wait for it to settle open instead of toggling.
      await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);
      await expect(page.getByLabel('priority', { exact: true })).toHaveValue('High');
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
