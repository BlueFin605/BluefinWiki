import type { Page } from '@playwright/test';
import { test, expect, createPage, updatePage, deletePageRecursive } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';

/**
 * Real-time updates: another tab, the API (MCP-style, no X-Client-Id) or
 * another user changes something and the open tab picks it up with no reload.
 *
 * Every API write below happens only after the tab's realtime socket is OPEN —
 * the local `/ws` server sends nothing on connect, so `trackRealtimeSocket`
 * records the socket's `open` event in the page. A write made before that
 * would be lost (the first open runs no catch-up) and the test would flake.
 */

/** Must run before the first navigation. */
async function trackRealtimeSocket(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Native = window.WebSocket;
    const w = window as unknown as { __realtimeOpen: boolean };
    w.__realtimeOpen = false;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (new URL(this.url).pathname === '/ws') {
          this.addEventListener('open', () => (w.__realtimeOpen = true));
        }
      }
    };
  });
}

async function waitForRealtime(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __realtimeOpen: boolean }).__realtimeOpen === true,
    undefined,
    { timeout: 10_000 },
  );
}

/** One failing cleanup step must not skip the rest (a leaked boardable type breaks board-settings-types). */
async function safely(step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (err) {
    console.warn('[realtime.spec] cleanup step failed', err);
  }
}

test.describe('Real-time updates', () => {
  test('a page renamed elsewhere (API, then another tab) updates the open tree live', async ({
    page,
    pageTree,
    request,
    browser,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const firstTitle = `${prefix} Live Tree First`;
    const apiTitle = `${prefix} Live Tree Via API`;
    const uiTitle = `${prefix} Live Tree Via Tab B`;
    const guid = await createPage(request, firstTitle, { parentGuid: pageTree.rootGuid });

    const b = await browser.newContext({ baseURL: 'http://localhost:5173' });
    try {
      await trackRealtimeSocket(page);
      await page.goto(`/pages/${pageTree.rootGuid}`);
      await page
        .getByRole('treeitem', { name: `${pageTree.runId} Root` })
        .getByRole('button', { name: 'Expand' })
        .click();
      await expect(page.getByRole('treeitem', { name: firstTitle })).toBeVisible();
      await waitForRealtime(page);

      // 1. Rename through the API (no X-Client-Id, like MCP / another user).
      await updatePage(request, guid, { title: apiTitle });
      await expect(page.getByRole('treeitem', { name: apiTitle })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('treeitem', { name: firstTitle })).toHaveCount(0);

      // 2. Rename from a second browser tab's UI (its own X-Client-Id, not A's).
      const pageB = await b.newPage();
      await pageB.goto(`/pages/${pageTree.rootGuid}`);
      await pageB
        .getByRole('treeitem', { name: `${pageTree.runId} Root` })
        .getByRole('button', { name: 'Expand' })
        .click();
      await pageB.getByRole('treeitem', { name: apiTitle }).click({ button: 'right' });
      await pageB.getByRole('menuitem', { name: 'Rename' }).click();
      const dialog = pageB.getByRole('dialog', { name: 'Rename page' });
      await dialog.getByLabel('Page title').fill(uiTitle);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();

      await expect(page.getByRole('treeitem', { name: uiTitle })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('treeitem', { name: apiTitle })).toHaveCount(0);
    } finally {
      await safely(() => b.close());
      await safely(() => deletePageRecursive(request, guid));
    }
  });

  test('a card moved through the API moves on the open board live', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Live Board Card Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    let parentGuid: string | null = null;

    try {
      parentGuid = await createPage(request, `${prefix} Live Board Parent`, { parentGuid: pageTree.rootGuid });
      await updatePage(request, parentGuid, { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } });
      const cardTitle = `${prefix} Live Board Card`;
      const cardGuid = await createPage(request, cardTitle, {
        parentGuid,
        pageType: typeGuid,
        properties: { state: { type: 'string', value: 'To Do' } },
      });

      await trackRealtimeSocket(page);
      await page.goto(`/pages/${parentGuid}`);
      const todo = page.locator('wiki-board-column', { hasText: 'To Do' });
      const done = page.locator('wiki-board-column', { hasText: 'Done' });
      await expect(todo.locator('[data-testid="board-column-count"]')).toHaveText('1');
      await expect(done).toHaveCount(0);
      await waitForRealtime(page);

      await updatePage(request, cardGuid, { properties: { state: { type: 'string', value: 'Done' } } });

      // No reload and no Refresh-board click: the push alone moves the card.
      // An empty, unconfigured column disappears (group-by-state.ts), so
      // "To Do" holding 0 cards shows as no To Do column at all.
      await expect(done.locator('[data-testid="board-column-count"]')).toHaveText('1', { timeout: 5000 });
      await expect(done.getByRole('button', { name: cardTitle })).toBeVisible();
      await expect(todo).toHaveCount(0);
    } finally {
      if (parentGuid) {
        const p = parentGuid;
        await safely(() => deletePageRecursive(request, p));
      }
      await safely(() => deletePageType(request, typeGuid));
    }
  });

  test('an unsaved edit survives a remote change: banner, then Reload shows the remote content', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const guid = await createPage(request, `${prefix} Live Clash Page`, {
      parentGuid: pageTree.rootGuid,
      content: '# Clash original',
    });
    const localText = `local unsaved ${pageTree.runId}`;
    const remoteText = `remote from api ${pageTree.runId}`;

    try {
      await trackRealtimeSocket(page);
      await page.goto(`/pages/${guid}/edit`);
      const editor = page.locator('.cm-content');
      await expect(editor).toContainText('Clash original');
      await waitForRealtime(page);

      await editor.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.type(localText);
      await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'unsaved');

      await updatePage(request, guid, { content: `# Clash remote\n\n${remoteText}` });

      const banner = page.getByText('This page was changed elsewhere.');
      await expect(banner).toBeVisible({ timeout: 5000 });
      // The working copy is held back, not replaced under the user.
      await expect(editor).toContainText(localText);
      await expect(editor).not.toContainText(remoteText);

      // Reload: no confirm dialog — straight to the server content.
      await page.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(editor).toContainText(remoteText);
      await expect(editor).not.toContainText(localText);
      await expect(banner).toBeHidden();
    } finally {
      await safely(() => deletePageRecursive(request, guid));
    }
  });
});
