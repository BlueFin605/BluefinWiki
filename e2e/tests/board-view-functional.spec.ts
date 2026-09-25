import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';

test.describe('Board view', () => {
  test('a board-eligible page groups its children into columns by state, and editing a card moves it between columns live', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Board Card Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });

    const parentGuid = await createPage(request, `${prefix} Board Parent`, {
      parentGuid: pageTree.rootGuid,
    });
    await updatePage(request, parentGuid, {
      boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' },
    });

    const todoTitle = `${prefix} Todo Card`;
    const doneTitle = `${prefix} Done Card`;
    await createPage(request, todoTitle, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    await createPage(request, doneTitle, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'Done' } },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);

      // `boardConfig.defaultView: 'board'` + `targetTypeGuid` set makes the
      // page board-eligible immediately — no manual Content|Board toggle needed.
      const todoColumn = page.locator('wiki-board-column', { hasText: 'To Do' });
      const doneColumn = page.locator('wiki-board-column', { hasText: 'Done' });
      await expect(todoColumn).toBeVisible();
      await expect(doneColumn).toBeVisible();
      await expect(todoColumn.getByRole('button', { name: todoTitle })).toBeVisible();
      await expect(doneColumn.getByRole('button', { name: doneTitle })).toBeVisible();
      await expect(todoColumn.locator('[data-testid="board-column-count"]')).toHaveText('1');
      await expect(doneColumn.locator('[data-testid="board-column-count"]')).toHaveText('1');

      // Editing a card's `state` property (the same field the board groups
      // by) via the Card Summary dialog must move it to the new column
      // immediately — no reload — proving the board recomputes from real
      // data, not just an optimistic drag patch.
      await todoColumn.getByRole('button', { name: todoTitle }).click();
      const dialog = page.getByRole('dialog').filter({ hasText: todoTitle });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('state').fill('Done');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();

      await expect(doneColumn.locator('[data-testid="board-column-count"]')).toHaveText('2');
      // groupByState only keeps an empty column when it's explicitly
      // configured via boardConfig.columns (group-by-state.ts) — this board
      // has none, so "To Do" disappears entirely once its last card leaves.
      await expect(todoColumn).toHaveCount(0);
      await expect(doneColumn.getByRole('button', { name: todoTitle })).toBeVisible();
      await expect(doneColumn.getByRole('button', { name: doneTitle })).toBeVisible();

      // Persists.
      await page.reload();
      const doneColumnAfterReload = page.locator('wiki-board-column', { hasText: 'Done' });
      await expect(doneColumnAfterReload.locator('[data-testid="board-column-count"]')).toHaveText('2');
    } finally {
      await deletePageType(request, typeGuid);
    }
  });

  test('Card Summary: Save is disabled until a field is dirty, and "Open full editor" opens the page in a new tab', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Summary Extra Type`, {
      properties: [
        { name: 'state', type: 'string', required: false },
        { name: 'notes', type: 'string', required: false },
      ],
    });
    const parentGuid = await createPage(request, `${prefix} Summary Extra Parent`, { parentGuid: pageTree.rootGuid });
    await updatePage(request, parentGuid, { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } });
    const cardTitle = `${prefix} Summary Extra Card`;
    const cardGuid = await createPage(request, cardTitle, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' }, notes: { type: 'string', value: 'original' } },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);
      const column = page.locator('wiki-board-column', { hasText: 'To Do' });
      await column.getByRole('button', { name: cardTitle }).click();

      const dialog = page.getByRole('dialog').filter({ hasText: cardTitle });
      const saveBtn = dialog.getByRole('button', { name: 'Save' });
      await expect(saveBtn).toBeDisabled();

      await dialog.getByLabel('notes').fill('updated notes');
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();
      await expect(dialog).toBeHidden();

      // Re-open and open the full editor.
      await column.getByRole('button', { name: cardTitle }).click();
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        page.getByRole('dialog').filter({ hasText: cardTitle }).getByRole('button', { name: 'Open full editor' }).click(),
      ]);
      await newPage.waitForLoadState();
      expect(newPage.url()).toContain(`/pages/${cardGuid}`);
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
