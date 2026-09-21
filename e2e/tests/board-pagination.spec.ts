import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { createManyChildren } from '../fixtures/bulk-pages';

test.describe('Board pagination', () => {
  // Skipped: fixture creation (201 pages under one parent) cannot finish in
  // bounded time against the real backend. `pages-create.ts` calls
  // `storagePlugin.listChildren(parentGuid)` on every single create just to
  // compute `sortOrder`, and `S3StoragePlugin.listChildren` does a
  // sequential (non-parallel) S3 round-trip per existing child -- making
  // bulk creation under one parent O(n^2) in S3 calls. Measured: a single,
  // zero-concurrency `POST /pages` at 150 existing siblings took 9.2s; batch
  // creation (BATCH_SIZE=15) blew a 120s budget at ~120/201 children with
  // superlinear per-batch growth. Not fixable by e2e-side batching or
  // timeout tuning. Deferred as documented product debt (2026-09-21); real
  // fix belongs in `backend/src/pages/pages-create.ts`'s sortOrder
  // computation and/or `S3StoragePlugin.listChildren`'s per-child scan.
  test.skip('a board with more than 200 cards shows Load more and loads the next page', async ({
    page,
    pageTree,
    request,
  }) => {
    test.setTimeout(120_000); // 201 batched POSTs take real wall-clock time

    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Pagination Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Pagination Parent`, { parentGuid: pageTree.rootGuid });
    await updatePage(request, parentGuid, { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } });

    await createManyChildren(request, parentGuid, 201, `${prefix} Card`, {
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);
      const column = page.locator('wiki-board-column', { hasText: 'To Do' });
      await expect(column).toBeVisible();
      await expect(column.locator('[data-testid="board-column-count"]')).toHaveText('200');

      const loadMore = page.getByRole('button', { name: /^Load more cards/ });
      await expect(loadMore).toBeVisible();
      await loadMore.click();
      await expect(loadMore).toBeHidden({ timeout: 15_000 });
      await expect(column.locator('[data-testid="board-column-count"]')).toHaveText('201');
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
