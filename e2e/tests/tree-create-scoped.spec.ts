import { test, expect, createPage } from '../fixtures/page-tree';
import { createPageType, deletePageType, allowChildTypes } from '../fixtures/page-types';
import { API_BASE_URL, AUTH_HEADER } from '../fixtures/api';

test.describe('Scoped child creation', () => {
  test('a typed parent with exactly one allowed child type auto-selects it', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const parentTypeGuid = await createPageType(request, `${prefix} Parent Type`, { properties: [] });
    const onlyChildTypeGuid = await createPageType(request, `${prefix} Only Child Type`, { properties: [] });
    await allowChildTypes(request, parentTypeGuid, [onlyChildTypeGuid]);

    // new-page-modal.ts:167-179's auto-select effect only fires when the
    // sole allowed type is paired with untyped wiki-page children being
    // DISALLOWED (`!this.allowWikiChildren()`) -- confirmed against
    // new-page-modal.spec.ts:349's "sole type + wiki disallowed ->
    // auto-selected" fixture comment, and against property-inheritance.spec.ts
    // (same "one allowed type" shape via `allowChildTypes`, but that test
    // still has to manually click the option because it never disables wiki
    // children). `allowChildTypes` only ever PUTs `allowedChildTypes`, so
    // disable wiki children with the same update endpoint the admin UI uses.
    const disallowWikiRes = await request.put(`${API_BASE_URL}/page-types/${parentTypeGuid}`, {
      headers: AUTH_HEADER,
      data: { allowWikiPageChildren: false },
    });
    if (!disallowWikiRes.ok()) {
      throw new Error(
        `Failed to disallow wiki children for "${parentTypeGuid}": ${disallowWikiRes.status()} ${await disallowWikiRes.text()}`,
      );
    }

    const parentTitle = `${prefix} Typed Parent`;
    const parentGuid = await createPage(request, parentTitle, {
      parentGuid: pageTree.rootGuid,
      pageType: parentTypeGuid,
    });

    try {
      await page.goto(`/pages/${parentGuid}`);

      // parentGuid is a child of pageTree.rootGuid, not a root-level page —
      // expand Root to reveal its row (the tree does not auto-expand
      // ancestors of the active page, by design; see
      // property-inheritance.spec.ts).
      await page
        .getByRole('treeitem', { name: `${pageTree.runId} Root` })
        .getByRole('button', { name: 'Expand' })
        .click();

      const parentRow = page.getByRole('treeitem', { name: parentTitle });
      await parentRow.click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'New child page' }).click();

      const modal = page.getByRole('dialog', { name: 'New page' });
      // Exactly one allowed type + wiki children disallowed -> the mat-select
      // renders (availableTypes().length > 0) with that type pre-selected as
      // its displayed value, rather than the default "(none)".
      await expect(modal.getByLabel('Page type')).toContainText(`${prefix} Only Child Type`);

      await modal.getByLabel('Title').fill(`${prefix} Scoped Child`);
      await modal.getByRole('button', { name: 'Create' }).click();
      await page.waitForURL(/\/pages\/.+\/edit/);
    } finally {
      await deletePageType(request, parentTypeGuid);
      await deletePageType(request, onlyChildTypeGuid);
    }
  });
});
