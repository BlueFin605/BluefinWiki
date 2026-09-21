import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { dragCardToColumn } from './helpers';

test.describe('Board optimistic drag + rollback', () => {
  test('dragging a card to another column moves it immediately', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Drag Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Drag Parent`, { parentGuid: pageTree.rootGuid });
    const cardTitle = `${prefix} Draggable Card`;
    await createPage(request, cardTitle, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    // No card carries state 'Done' yet — groupByState only derives columns
    // from states actually present among the children (group-by-state.ts),
    // so without an explicit `columns` config the destination column
    // wouldn't exist to drag into. Configuring `columns` makes it present
    // (and visible, empty) up front, per that file's documented rule:
    // "Configured columns are always present, even when empty."
    await updatePage(request, parentGuid, {
      boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board', columns: ['To Do', 'Done'] },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);

      const todoColumn = page.locator('wiki-board-column', { hasText: 'To Do' });
      const doneColumn = page.locator('wiki-board-column', { hasText: 'Done' });
      const card = todoColumn.getByRole('button', { name: cardTitle });
      await expect(card).toBeVisible();
      await expect(doneColumn).toBeVisible();

      await dragCardToColumn(page, card, doneColumn);
      await expect(doneColumn.getByRole('button', { name: cardTitle })).toBeVisible({ timeout: 5000 });
    } finally {
      await deletePageType(request, typeGuid);
    }
  });

  test('a failed PUT during drag rolls the card back with a toast', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Rollback Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Rollback Parent`, {
      parentGuid: pageTree.rootGuid,
    });
    const cardTitle = `${prefix} Rollback Card`;
    const cardGuid = await createPage(request, cardTitle, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    await updatePage(request, parentGuid, {
      boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board', columns: ['To Do', 'Done'] },
    });

    try {
      await page.route(`**/api/pages/${cardGuid}`, (route) => {
        if (route.request().method() === 'PUT') {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Simulated PUT failure' }),
          });
        }
        return route.continue();
      });

      await page.goto(`/pages/${parentGuid}`);
      const todoColumn = page.locator('wiki-board-column', { hasText: 'To Do' });
      const doneColumn = page.locator('wiki-board-column', { hasText: 'Done' });
      const card = todoColumn.getByRole('button', { name: cardTitle });
      await expect(card).toBeVisible();
      await expect(doneColumn).toBeVisible();

      await dragCardToColumn(page, card, doneColumn);

      // Rolls back: card returns to To Do, error toast shown. Toast text
      // matches board-view.ts's onCardDropped() failure path: `Couldn't move
      // card — ${message}${suffix}` (frontend/src/app/features/board/board-view.ts).
      await expect(page.getByText(/Couldn't move card/)).toBeVisible({ timeout: 10_000 });
      await expect(todoColumn.getByRole('button', { name: cardTitle })).toBeVisible();
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
