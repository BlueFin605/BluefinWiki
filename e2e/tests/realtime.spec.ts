import type { Page } from '@playwright/test';
import { test, expect, createPage, updatePage, deletePageRecursive } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { dragCardToColumn, expandRow } from './helpers';

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

interface RealtimeFrame {
  type: string;
  tags?: string[];
  pages?: { guid: string }[];
}

/**
 * Records a tab's `/children` + `/ancestors` GETs and the realtime frames it
 * receives. Must run before the first navigation.
 *
 * Other spec files run in parallel against the same server, and every write
 * is broadcast to every tab — so a coarse `children:*` / `ancestors:*`
 * invalidate from someone else's move or delete can legitimately refetch a
 * list mid-test. {@link Recorder.unexplained} therefore only counts requests
 * in a window where no such foreign invalidate arrived.
 */
class Recorder {
  readonly requests: string[] = [];
  readonly frames: RealtimeFrame[] = [];

  constructor(page: Page) {
    page.on('request', (r) => {
      const path = new URL(r.url()).pathname;
      if (r.method() === 'GET' && /\/api\/pages\/[^/]+\/(children|ancestors)$/.test(path)) this.requests.push(path);
    });
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname !== '/ws') return;
      ws.on('framereceived', (f) => {
        try {
          this.frames.push(JSON.parse(String(f.payload)) as RealtimeFrame);
        } catch {
          // pong or other non-JSON frame
        }
      });
    });
  }

  mark(): { requests: number; frames: number } {
    return { requests: this.requests.length, frames: this.frames.length };
  }

  /** Requests matching `kind` since `from`, unless a coarse invalidate for that kind explains them. */
  unexplained(from: { requests: number; frames: number }, kind: RegExp): string[] {
    const requests = this.requests.slice(from.requests).filter((p) => kind.test(p));
    const coarse = this.frames
      .slice(from.frames)
      .some((f) => f.type === 'invalidate' && f.tags?.some((t) => /^(children|ancestors):/.test(t)));
    return coarse ? [] : requests;
  }

  sawUpsert(guid: string, from = { frames: 0 }): boolean {
    return this.frames
      .slice(from.frames)
      .some((f) => f.type === 'upsert' && f.pages?.some((p) => p.guid === guid));
  }
}

/** Long enough for a stray refetch triggered by the last message to have gone out. */
const QUIET_MS = 750;

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
  test('a card dragged in tab A moves in tab B with no board refetch in either tab', async ({
    page,
    pageTree,
    request,
    browser,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Upsert Card Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    let parentGuid: string | null = null;
    const b = await browser.newContext({ baseURL: 'http://localhost:5173' });

    try {
      parentGuid = await createPage(request, `${prefix} Upsert Board`, { parentGuid: pageTree.rootGuid });
      await updatePage(request, parentGuid, {
        boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board', columns: ['To Do', 'Done'] },
      });
      const cardTitle = `${prefix} Upsert Card`;
      const cardGuid = await createPage(request, cardTitle, {
        parentGuid,
        pageType: typeGuid,
        properties: { state: { type: 'string', value: 'To Do' } },
      });

      const pageB = await b.newPage();
      const recA = new Recorder(page);
      const recB = new Recorder(pageB);
      for (const p of [page, pageB]) {
        await trackRealtimeSocket(p);
        await p.goto(`/pages/${parentGuid}`);
        const todo = p.locator('wiki-board-column', { hasText: 'To Do' });
        await expect(todo.getByRole('button', { name: cardTitle })).toBeVisible();
        await waitForRealtime(p);
        await p.waitForLoadState('networkidle');
      }
      const fromA = recA.mark();
      const fromB = recB.mark();

      const todoA = page.locator('wiki-board-column', { hasText: 'To Do' });
      const doneA = page.locator('wiki-board-column', { hasText: 'Done' });
      const put = page.waitForResponse(
        (r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/pages/${cardGuid}`),
      );
      await dragCardToColumn(page, todoA.getByRole('button', { name: cardTitle }), doneA);
      expect((await put).ok()).toBe(true);

      const doneB = pageB.locator('wiki-board-column', { hasText: 'Done' });
      await expect(doneB.getByRole('button', { name: cardTitle })).toBeVisible({ timeout: 5000 });
      await expect(doneA.getByRole('button', { name: cardTitle })).toBeVisible();
      await page.waitForTimeout(QUIET_MS);

      expect(recB.sawUpsert(cardGuid, fromB)).toBe(true);
      expect(recB.unexplained(fromB, /\/children$/)).toEqual([]);
      expect(recA.unexplained(fromA, /\/children$/)).toEqual([]);
    } finally {
      await safely(() => b.close());
      if (parentGuid) {
        const p = parentGuid;
        await safely(() => deletePageRecursive(request, p));
      }
      await safely(() => deletePageType(request, typeGuid));
    }
  });

  test("a rename in tab A updates tab B's tree row and breadcrumb with no list refetch", async ({
    page,
    pageTree,
    request,
    browser,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const folderTitle = `${prefix} Upsert Folder`;
    const renamed = `${prefix} Upsert Folder Renamed`;
    const folderGuid = await createPage(request, folderTitle, { parentGuid: pageTree.rootGuid });
    const leafGuid = await createPage(request, `${prefix} Upsert Leaf`, { parentGuid: folderGuid });
    const b = await browser.newContext({ baseURL: 'http://localhost:5173' });

    try {
      // B sits on the leaf: its tree auto-expands to show the folder row, and
      // its breadcrumb runs through the folder.
      const pageB = await b.newPage();
      const recB = new Recorder(pageB);
      await trackRealtimeSocket(pageB);
      await pageB.goto(`/pages/${leafGuid}`);
      const crumbs = pageB.locator('nav[aria-label="Breadcrumb"]');
      await expect(crumbs.getByText(folderTitle, { exact: true })).toBeVisible();
      await expect(pageB.getByRole('treeitem', { name: folderTitle })).toBeVisible();
      await waitForRealtime(pageB);
      await pageB.waitForLoadState('networkidle');
      const fromB = recB.mark();

      await page.goto(`/pages/${pageTree.rootGuid}`);
      await expandRow(page.getByRole('treeitem', { name: `${pageTree.runId} Root` }));
      await page.getByRole('treeitem', { name: folderTitle }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      const dialog = page.getByRole('dialog', { name: 'Rename page' });
      await dialog.getByLabel('Page title').fill(renamed);
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).toBeHidden();

      await expect(pageB.getByRole('treeitem', { name: renamed })).toBeVisible({ timeout: 5000 });
      await expect(crumbs.getByText(renamed, { exact: true })).toBeVisible({ timeout: 5000 });
      await pageB.waitForTimeout(QUIET_MS);

      expect(recB.sawUpsert(folderGuid, fromB)).toBe(true);
      expect(recB.unexplained(fromB, /\/(children|ancestors)$/)).toEqual([]);
    } finally {
      await safely(() => b.close());
      await safely(() => deletePageRecursive(request, folderGuid));
    }
  });

  test("a page created elsewhere appears under its parent in the open tree with one list fetch", async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const folderGuid = await createPage(request, `${prefix} Upsert Create Folder`, { parentGuid: pageTree.rootGuid });
    const existingTitle = `${prefix} Upsert Existing`;
    const existingGuid = await createPage(request, existingTitle, { parentGuid: folderGuid });
    const newTitle = `${prefix} Upsert Created`;

    try {
      const rec = new Recorder(page);
      await trackRealtimeSocket(page);
      await page.goto(`/pages/${existingGuid}`);
      await expect(page.getByRole('treeitem', { name: existingTitle })).toBeVisible();
      await waitForRealtime(page);
      await page.waitForLoadState('networkidle');
      const from = rec.mark();

      // The server pushes the new page as an upsert; the tree's list for the
      // folder doesn't hold it, so it refetches that one list.
      const newGuid = await createPage(request, newTitle, { parentGuid: folderGuid });

      await expect(page.getByRole('treeitem', { name: newTitle })).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(QUIET_MS);

      expect(rec.sawUpsert(newGuid, from)).toBe(true);
      const folderFetches = rec.unexplained(from, new RegExp(`/api/pages/${folderGuid}/children$`));
      expect(folderFetches.length).toBeLessThanOrEqual(1);
    } finally {
      await safely(() => deletePageRecursive(request, folderGuid));
    }
  });

  test('an archived page leaves the open tree through the coarse invalidate path, not an upsert', async ({
    page,
    pageTree,
    request,
  }) => {
    // Archived (like draft) saves fall back to coarse tags on the server —
    // drafts can't be produced through the API, so archive stands in for both.
    const prefix = `E2E-${pageTree.runId}`;
    const folderTitle = `${prefix} Archive Folder`;
    const folderGuid = await createPage(request, folderTitle, { parentGuid: pageTree.rootGuid });
    const doomedTitle = `${prefix} Archive Me`;
    const doomedGuid = await createPage(request, doomedTitle, { parentGuid: folderGuid });

    try {
      const rec = new Recorder(page);
      await trackRealtimeSocket(page);
      await page.goto(`/pages/${folderGuid}`);
      await expandRow(page.getByRole('treeitem', { name: folderTitle }));
      await expect(page.getByRole('treeitem', { name: doomedTitle })).toBeVisible();
      await waitForRealtime(page);
      const from = rec.mark();

      await updatePage(request, doomedGuid, { status: 'archived' });

      await expect(page.getByRole('treeitem', { name: doomedTitle })).toHaveCount(0, { timeout: 5000 });
      expect(rec.sawUpsert(doomedGuid, from)).toBe(false);
      expect(
        rec.frames.slice(from.frames).some((f) => f.type === 'invalidate' && f.tags?.includes(`page:${doomedGuid}`)),
      ).toBe(true);
    } finally {
      await safely(() => deletePageRecursive(request, folderGuid));
    }
  });
});
