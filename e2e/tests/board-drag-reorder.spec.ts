import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { dragCardToColumn } from './helpers';

test.describe('Board positional reorder (boardOrder)', () => {
  test('dropping a card between two siblings persists order across reload', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Reorder Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Reorder Parent`, { parentGuid: pageTree.rootGuid });
    await updatePage(request, parentGuid, {
      boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' },
    });

    const titleA = `${prefix} Card A`;
    const titleB = `${prefix} Card B`;
    const titleC = `${prefix} Card C`;
    const cardAGuid = await createPage(request, titleA, { parentGuid, pageType: typeGuid, properties: { state: { type: 'string', value: 'To Do' } } });
    const cardBGuid = await createPage(request, titleB, { parentGuid, pageType: typeGuid, properties: { state: { type: 'string', value: 'To Do' } } });
    const cardCGuid = await createPage(request, titleC, { parentGuid, pageType: typeGuid, properties: { state: { type: 'string', value: 'To Do' } } });
    // group-by-state.ts sorts cards WITHOUT an explicit boardOrder by
    // modifiedAt descending (newest first) — since these three are created
    // back-to-back, that would render them newest-first (C, B, A), not in
    // creation order. Stamp an explicit boardOrder on each so the initial
    // render is deterministically A, B, C, matching the drag geometry below.
    await updatePage(request, cardAGuid, { boardOrder: 1000 });
    await updatePage(request, cardBGuid, { boardOrder: 2000 });
    await updatePage(request, cardCGuid, { boardOrder: 3000 });

    try {
      await page.goto(`/pages/${parentGuid}`);
      const column = page.locator('wiki-board-column', { hasText: 'To Do' });
      await expect(column.getByRole('button', { name: titleC })).toBeVisible();

      // Assert the initial rendered order (A, B, C) before dragging, so a
      // future geometry regression fails loudly here instead of silently
      // computing the drop offset against the wrong drop target below.
      const initialOrder = await column.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      expect(initialOrder.indexOf(titleA)).toBeLessThan(initialOrder.indexOf(titleB));
      expect(initialOrder.indexOf(titleB)).toBeLessThan(initialOrder.indexOf(titleC));

      // Move Card C to land between A and B (initial order: A, B, C).
      const cardC = column.getByRole('button', { name: titleC });
      const cardB = column.getByRole('button', { name: titleB });
      const cardBBox = await cardB.boundingBox();
      // dragCardToColumn applies its numeric offset as `containerBox.y +
      // position`, where containerBox is `column.locator('.cards')` — the
      // inner cards container, NOT the column host. Measure from that same
      // element here so "just above Card B" matches the helper's real
      // geometry (the column host also includes the ~35-40px `.header` above
      // `.cards`, which would otherwise land the offset too low).
      const cardsBox = await column.locator('.cards').boundingBox();
      if (!cardBBox || !cardsBox) throw new Error('missing bounding box');
      await dragCardToColumn(page, cardC, column, cardBBox.y - cardsBox.y - 5); // just above Card B

      const orderAfterDrag = await column.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      expect(orderAfterDrag.indexOf(titleC)).toBeLessThan(orderAfterDrag.indexOf(titleB));
      expect(orderAfterDrag.indexOf(titleC)).toBeGreaterThan(orderAfterDrag.indexOf(titleA));

      await page.reload();
      const columnAfterReload = page.locator('wiki-board-column', { hasText: 'To Do' });
      await expect(columnAfterReload.getByRole('button', { name: titleC })).toBeVisible();
      const orderAfterReload = await columnAfterReload.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      expect(orderAfterReload.indexOf(titleC)).toBeLessThan(orderAfterReload.indexOf(titleB));
      expect(orderAfterReload.indexOf(titleC)).toBeGreaterThan(orderAfterReload.indexOf(titleA));
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
