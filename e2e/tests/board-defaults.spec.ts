import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { allowChildTypes, createPageType, deletePageType } from '../fixtures/page-types';
import { API_BASE_URL, AUTH_HEADER } from '../fixtures/api';

const STATE = [{ name: 'state', type: 'string' as const, required: false }];

// The mock e2e user is Admin, so the "Save as default" button is visible.
// Pages are removed by the worker-scoped pageTree fixture; the page types are
// created here, so each is deleted here in `finally`, guarded individually.
test('board defaults: set from one board, followed by another, per-group override sticks', async ({
  page,
  pageTree,
  request,
}) => {
  const prefix = `E2E-${pageTree.runId}`;
  const created: string[] = [];
  try {
    const cardType = await createPageType(request, `${prefix} BD Card`, { properties: STATE });
    created.push(cardType);
    const boardType = await createPageType(request, `${prefix} BD Board`, { properties: STATE });
    created.push(boardType);
    await allowChildTypes(request, boardType, [cardType]);

    const ready = { state: { type: 'string' as const, value: 'Ready' } };
    const a = await createPage(request, `${prefix} BD A`, {
      parentGuid: pageTree.rootGuid,
      pageType: boardType,
      properties: ready,
    });
    const b = await createPage(request, `${prefix} BD B`, {
      parentGuid: pageTree.rootGuid,
      pageType: boardType,
      properties: ready,
    });
    for (const [parent, label] of [[a, 'A'], [b, 'B']] as const) {
      await createPage(request, `${prefix} BD card of ${label}`, {
        parentGuid: parent,
        pageType: cardType,
        properties: { state: { type: 'string', value: 'Doing' } },
      });
    }
    // A gets explicit columns via the API, then promotes them in the UI.
    await updatePage(request, a, {
      boardConfig: { columns: ['Doing', 'Shipped'], targetTypeGuids: [cardType], defaultView: 'board' },
    });

    await page.goto(`/pages/${a}`);
    await page.getByRole('button', { name: 'Board settings' }).click();
    const saved = page.waitForResponse(
      (r) => r.url().includes(`/page-types/${boardType}`) && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /save as default for .* BD Board pages/i }).click();
    // It changes every page of the type, so it asks first.
    await page.getByRole('dialog').getByRole('button', { name: 'Save as default', exact: true }).click();
    expect((await saved).ok()).toBeTruthy();

    // B has no settings of its own: it opens on the board with A's columns.
    await page.goto(`/pages/${b}`);
    await expect(page.locator('wiki-board-column', { hasText: 'Shipped' })).toBeVisible();

    // Override only B's columns.
    await page.getByRole('button', { name: 'Board settings' }).click();
    await page.getByLabel('New column').fill('Parked');
    await page.getByRole('button', { name: /^add$/i }).click();
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.locator('wiki-board-column', { hasText: 'Parked' })).toBeVisible();

    // Change the type default's view to content; B (which only overrode columns) follows.
    const res = await request.put(`${API_BASE_URL}/page-types/${boardType}`, {
      headers: AUTH_HEADER,
      data: { boardDefaults: { columns: ['Doing', 'Shipped'], targetTypeGuids: [cardType], defaultView: 'content' } },
    });
    expect(res.ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Content' })).toBeChecked();
    await page.getByRole('radio', { name: 'Board' }).click();
    await expect(page.locator('wiki-board-column', { hasText: 'Parked' })).toBeVisible();

    // A cards-group change made through the UI on A reaches B, which never
    // overrode that group.
    await page.goto(`/pages/${a}`);
    await page.getByRole('radio', { name: 'Board' }).click();
    await page.getByRole('button', { name: 'Board settings' }).click();
    await page.getByRole('radio', { name: 'Leaf types' }).click();
    const savedLeaf = page.waitForResponse(
      (r) => r.url().includes(`/page-types/${boardType}`) && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /save as default for .* BD Board pages/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save as default', exact: true }).click();
    expect((await savedLeaf).ok()).toBeTruthy();

    await page.goto(`/pages/${b}`);
    await page.getByRole('radio', { name: 'Board' }).click();
    await expect(page.locator('wiki-board-column', { hasText: 'Parked' })).toBeVisible();
    await page.getByRole('button', { name: 'Board settings' }).click();
    await expect(page.getByRole('radio', { name: 'Leaf types' })).toBeChecked();
  } finally {
    for (const t of created) {
      try {
        await deletePageType(request, t);
      } catch {
        // best-effort cleanup
      }
    }
  }
});
