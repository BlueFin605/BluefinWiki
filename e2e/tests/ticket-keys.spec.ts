import type { Page } from '@playwright/test';
import { test, expect as baseExpect, createPage, updatePage } from '../fixtures/page-tree';
import { callTool, refOf, withTicketTypes } from '../fixtures/kanban';
import { API_BASE_URL, AUTH_HEADER } from '../fixtures/api';
import { openSearch } from './helpers';

/**
 * Ticket keys end to end: an Initiative with a key prefix keys the tickets
 * created under it; keys show on board cards and the page header, resolve via
 * /t/:key, /pages/:key, [[KEY]] links, search and the MCP tools, and the
 * backfill keys tickets created before the prefix was set.
 */

// Most steps wait on a server round trip, which can take several seconds when the
// whole suite runs in parallel against the local stack.
const expect = baseExpect.configure({ timeout: 15_000 });

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Expand tree rows by title, outermost first. */
async function expandTree(page: Page, titles: string[]): Promise<void> {
  for (const title of titles) {
    await page.getByRole('treeitem', { name: title }).getByRole('button', { name: 'Expand' }).click();
  }
}

test.describe('Ticket keys', () => {
  test('keys are assigned, shown, resolved everywhere a page reference is accepted, and backfilled', async ({
    page,
    pageTree,
    request,
  }) => {
    test.setTimeout(240_000); // may wait on another spec holding the ticket-types lock
    // A fresh prefix per run, so its counter starts at 1: ^[A-Z][A-Z0-9]{1,9}$.
    const prefix = 'E' + pageTree.runId.replace(/[^A-Za-z0-9]/g, '').slice(-9).toUpperCase();
    const tag = `E2E-${pageTree.runId}`;
    const t = (s: string) => `${tag} ${s}`;
    const key = (n: number) => `${prefix}-${n}`;

    await withTicketTypes(request, async () => {
      const types = await request.get(`${API_BASE_URL}/page-types`, { headers: AUTH_HEADER });
      const initiativeType = ((await types.json()) as { pageTypes: { guid: string; name: string }[] })
        .pageTypes.find((p) => p.name === 'Initiative')!.guid;
      const initiativeGuid = await createPage(request, t('Initiative'), {
        parentGuid: pageTree.rootGuid,
        pageType: initiativeType,
        properties: { state: { type: 'string', value: 'In Progress' } },
      });
      const boardConfig = { leafTypes: true, depth: 3, defaultView: 'board' };
      await updatePage(request, initiativeGuid, { boardConfig });

      // Before the prefix is set, tickets are unkeyed: refs are GUIDs.
      const oldTree = await callTool(request, 'kanban_create', {
        parentGuid: initiativeGuid,
        tree: { type: 'Epic', title: t('Old epic'), children: [
          { type: 'Story', title: t('Old story'), children: [{ type: 'Task', title: t('Old task') }] },
        ] },
      });
      for (const line of oldTree.split('\n')) expect(refOf(line)).toMatch(GUID_RE);
      const oldTaskGuid = refOf(oldTree.split('\n')[2]);

      await updatePage(request, initiativeGuid, { boardConfig: { ...boardConfig, keyPrefix: prefix } });

      const newTree = await callTool(request, 'kanban_create', {
        parentGuid: initiativeGuid,
        tree: { type: 'Epic', title: t('New epic'), children: [
          { type: 'Story', title: t('New story'), children: [{ type: 'Task', title: t('New task') }] },
        ] },
      });
      expect(newTree.split('\n').map(refOf)).toEqual([key(1), key(2), key(3)]);

      const card = await callTool(request, 'kanban_get', { guid: key(3).toLowerCase() });
      const [header, guidLine] = card.split('\n');
      expect(header).toBe(`Task · Ready · ${t('New task')} · ${key(3)}`);
      expect(guidLine).toMatch(/^Guid: [0-9a-f-]{36}$/);
      const newTaskGuid = guidLine.slice('Guid: '.length);

      // The generic MCP tools take the key too. (get_page reads S3 directly via
      // PAGES_BUCKET, which the local stack doesn't set, so comments stand in.)
      await callTool(request, 'add_comment', { pageGuid: key(3).toLowerCase(), body: 'via key' });
      expect(await callTool(request, 'list_comments', { pageGuid: key(3) })).toContain('via key');

      await test.step('board cards show keys; Open full editor prefers the key', async () => {
        await page.goto(`/pages/${initiativeGuid}`);
        const newCard = page.getByRole('button', { name: `${key(3)} ${t('New task')}` });
        await expect(newCard.getByTestId('board-card-key')).toHaveText(key(3));
        const oldCard = page.getByRole('button', { name: t('Old task'), exact: true });
        await expect(oldCard.getByTestId('board-card-key')).toHaveCount(0);

        for (const [cardLocator, expected] of [[newCard, `/pages/${key(3)}`], [oldCard, `/pages/${oldTaskGuid}`]] as const) {
          await cardLocator.click();
          const popup = page.waitForEvent('popup');
          await page.getByRole('button', { name: /open full editor/i }).click();
          const tab = await popup;
          await expect.poll(() => new URL(tab.url()).pathname).toBe(expected);
          await tab.close();
          await page.keyboard.press('Escape');
        }
      });

      await test.step('/pages/KEY renders the ticket, keeps the key, highlights the tree row', async () => {
        await page.goto(`/pages/${key(3)}`);
        await expect(page.getByTestId('page-ticket-key')).toHaveText(key(3));
        await expect(page).toHaveURL(new RegExp(`/pages/${key(3)}$`));
        await expandTree(page, [`${pageTree.runId} Root`, t('Initiative'), t('New epic'), t('New story')]);
        await expect(page.getByRole('treeitem', { name: t('New task') })).toHaveAttribute('aria-selected', 'true');
      });

      await test.step('edit + save returns to the key URL', async () => {
        await page.getByRole('radio', { name: 'Edit' }).click();
        await expect(page).toHaveURL(new RegExp(`/pages/${key(3)}/edit$`));
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/pages/${key(3)}$`));
      });

      await test.step('/t/KEY lands on /pages/KEY; unknown keys are not found', async () => {
        await page.goto(`/t/${key(3).toLowerCase()}`);
        await expect(page).toHaveURL(new RegExp(`/pages/${key(3)}$`));
        await expect(page.getByTestId('page-ticket-key')).toHaveText(key(3));

        await page.goto('/t/NOPE-99999');
        await expect(page.getByText(/not found/i).first()).toBeVisible();
        await page.goto('/pages/NOPE-99999');
        await expect(page.getByTestId('page-key-not-found')).toContainText('NOPE-99999');
      });

      await test.step('[[KEY]] links open the ticket', async () => {
        const linking = await createPage(request, t('Links to ticket'), {
          parentGuid: pageTree.rootGuid,
          content: `See [[${key(3)}]] for details.`,
        });
        await page.goto(`/pages/${linking}`);
        const link = page.getByRole('link', { name: key(3) });
        await expect(link).toHaveAttribute('href', `/pages/${key(3)}`);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`/pages/${key(3)}$`));
        await expect(page.getByTestId('page-ticket-key')).toHaveText(key(3));
      });

      await test.step('search pins a key match', async () => {
        await page.goto(`/pages/${pageTree.rootGuid}`);
        await openSearch(page);
        await page.getByRole('dialog', { name: 'Search wiki' }).locator('input').first().fill(key(3));
        await page.getByTestId('search-key-match').click();
        await expect(page).toHaveURL(new RegExp(`/pages/${key(3)}$`));
      });

      await test.step('backfill keys the old tickets, and is idempotent', async () => {
        await page.goto(`/pages/${initiativeGuid}`);
        await page.getByRole('button', { name: 'Board settings' }).click();
        const assign = page.getByRole('dialog', { name: 'Board settings' }).getByRole('button', { name: 'Assign keys to existing tickets' });
        await expect(assign).toBeEnabled();
        // The backfill walks the whole initiative, which is slow under a parallel run.
        const backfill = page.waitForResponse((r) => r.url().endsWith('/ticket-keys/backfill'), { timeout: 30_000 });
        await assign.click();
        expect(await (await backfill).json()).toEqual({ assigned: 3, repaired: 0 });
        await expect(page.getByText('Assigned 3, repaired 0')).toBeVisible();
        await page.keyboard.press('Escape');

        await page.reload();
        const oldKey = page.getByRole('button', { name: new RegExp(`${t('Old task')}$`) }).getByTestId('board-card-key');
        await expect(oldKey).toHaveText(new RegExp(`^${prefix}-(\\d+)$`));
        expect(Number((await oldKey.textContent())!.split('-').pop())).toBeGreaterThan(3);

        const again = await request.post(`${API_BASE_URL}/pages/${initiativeGuid}/ticket-keys/backfill`, { headers: AUTH_HEADER });
        expect(await again.json()).toEqual({ assigned: 0, repaired: 0 });
      });

      expect(newTaskGuid).toMatch(GUID_RE);
    });
  });
});
