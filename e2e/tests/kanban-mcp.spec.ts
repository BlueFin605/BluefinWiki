import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { callTool, withTicketTypes } from '../fixtures/kanban';

/**
 * The kanban_* MCP tools (used by the bluefin-kanban skill) drive the same
 * `state` property the board UI groups by: tickets created and moved over MCP
 * must show up in the right board columns.
 */

/** "Type · State · Title · guid" → guid (this board has no key prefix, so refs are GUIDs) */
const guidOf = (line: string) => line.split(' · ').pop()!;

test.describe('Kanban MCP tools', () => {
  test('tickets created and moved via kanban_* tools land in the matching board columns', async ({
    page,
    pageTree,
    request,
  }) => {
    test.setTimeout(180_000); // may wait on another spec holding the ticket-types lock
    const prefix = `E2E-${pageTree.runId}`;

    await withTicketTypes(request, async (types) => {
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

      // Tags: a tagged ticket shows up under the board's tag filter until the tag is removed.
      const storyGuid = guidOf(created.split('\n')[1]);
      const deanTitle = `${prefix} Dean task`;
      const deanGuid = guidOf(await callTool(request, 'kanban_create', {
        parentGuid: storyGuid,
        tree: { type: 'Task', title: deanTitle, state: 'Blocked', tags: ['Dean'] },
      }));
      const deanBoard = await callTool(request, 'kanban_board', { initiative: initiativeGuid, tags: ['dean'] });
      expect(deanBoard).toContain(`Task · Blocked · ${deanTitle} · ${deanGuid} · #dean`);
      expect(deanBoard).not.toContain(firstTitle);

      expect(await callTool(request, 'kanban_set_state', { guid: deanGuid, state: 'Done', removeTags: ['dean'] }))
        .toMatch(new RegExp(`^Task · Done · ${deanTitle} · ${deanGuid}$`, 'm'));
      expect(await callTool(request, 'kanban_board', { initiative: initiativeGuid, tags: ['dean'] })).not.toContain(deanGuid);
    });
  });
});
