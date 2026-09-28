import type { APIRequestContext } from '@playwright/test';
import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType, allowChildTypes } from '../fixtures/page-types';
import { API_BASE_URL, AUTH_HEADER } from '../fixtures/api';

/**
 * The kanban_* MCP tools (used by the bluefin-kanban skill) drive the same
 * `state` property the board UI groups by: tickets created and moved over MCP
 * must show up in the right board columns.
 *
 * The tools look page types up by their exact names (Initiative/Epic/Story/
 * Task), so this spec can't use the usual run-id prefix — it removes any
 * leftover types with those names first, and its own on the way out.
 */
const TICKET_TYPES = ['Initiative', 'Epic', 'Story', 'Task'] as const;

async function callTool(request: APIRequestContext, name: string, args: Record<string, unknown>): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/mcp`, {
    headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } };
  const text = body.result.content[0].text;
  if (body.result.isError) throw new Error(`${name} failed: ${text}`);
  return text;
}

/** "Type · State · Title · guid" → guid */
const guidOf = (line: string) => line.split(' · ').pop()!;

async function removeTicketTypes(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${API_BASE_URL}/page-types`, { headers: AUTH_HEADER });
  const { pageTypes } = (await res.json()) as { pageTypes: { guid: string; name: string }[] };
  for (const t of pageTypes) {
    if ((TICKET_TYPES as readonly string[]).includes(t.name)) await deletePageType(request, t.guid);
  }
}

test.describe('Kanban MCP tools', () => {
  test('tickets created and moved via kanban_* tools land in the matching board columns', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    await removeTicketTypes(request);

    const state = [{ name: 'state', type: 'string' as const, required: true }];
    const types: Record<string, string> = {};
    for (const name of TICKET_TYPES) types[name] = await createPageType(request, name, { properties: state });
    await allowChildTypes(request, types.Initiative, [types.Epic]);
    await allowChildTypes(request, types.Epic, [types.Story]);
    await allowChildTypes(request, types.Story, [types.Task]);

    try {
      const initiativeGuid = await createPage(request, `${prefix} Initiative`, {
        parentGuid: pageTree.rootGuid,
        pageType: types.Initiative,
        properties: { state: { type: 'string', value: 'In Progress' } },
      });
      await updatePage(request, initiativeGuid, {
        boardConfig: { targetTypeGuid: types.Task, depth: 3, defaultView: 'board' },
      });

      expect(await callTool(request, 'kanban_initiatives', {})).toContain(`${initiativeGuid} · ${prefix} Initiative · In Progress · 0 open`);

      const firstTitle = `${prefix} First task`;
      const secondTitle = `${prefix} Second task`;
      const created = await callTool(request, 'kanban_create', {
        parentGuid: initiativeGuid,
        tree: {
          type: 'Epic', title: `${prefix} Epic`, body: 'Spec: docs/spec.md',
          children: [{ type: 'Story', title: `${prefix} Story`, children: [
            { type: 'Task', title: firstTitle, body: 'Do the first thing' },
            { type: 'Task', title: secondTitle },
          ] }],
        },
      });
      expect(created.split('\n')).toHaveLength(4);

      const card = await callTool(request, 'kanban_next', { initiative: initiativeGuid, claim: true });
      const [header] = card.split('\n');
      expect(header).toMatch(new RegExp(`^Task · In Progress · ${firstTitle} · `));
      expect(card).toContain(`Path: ${prefix} Initiative › ${prefix} Epic › ${prefix} Story`);
      expect(card).toContain('Do the first thing');
      const firstGuid = guidOf(header);

      await page.goto(`/pages/${initiativeGuid}`);
      const inProgress = page.locator('wiki-board-column', { hasText: 'In Progress' });
      const ready = page.locator('wiki-board-column', { hasText: 'Ready' });
      await expect(inProgress.getByRole('button', { name: firstTitle })).toBeVisible();
      await expect(ready.getByRole('button', { name: secondTitle })).toBeVisible();

      expect(await callTool(request, 'kanban_set_state', { guid: firstGuid, state: 'Done', comment: 'commit abc123' }))
        .toBe(`Task · Done · ${firstTitle} · ${firstGuid}`);

      const second = await callTool(request, 'kanban_next', { initiative: initiativeGuid, claim: true });
      const closed = await callTool(request, 'kanban_set_state', { guid: guidOf(second.split('\n')[0]), state: 'Done', rollup: true });
      expect(closed.split('\n').slice(1)).toEqual([
        expect.stringMatching(/^closed: Story · /),
        expect.stringMatching(/^closed: Epic · /),
        `closeable: Initiative · ${prefix} Initiative · ${initiativeGuid}`,
      ]);

      await page.reload();
      const done = page.locator('wiki-board-column', { hasText: 'Done' });
      await expect(done.locator('[data-testid="board-column-count"]')).toHaveText('2');
      await expect(done.getByRole('button', { name: firstTitle })).toBeVisible();

      // The MCP comment is on the ticket page.
      expect(await callTool(request, 'kanban_get', { guid: firstGuid })).toContain('MCP Client: commit abc123');
    } finally {
      for (const guid of Object.values(types)) await deletePageType(request, guid);
    }
  });
});
