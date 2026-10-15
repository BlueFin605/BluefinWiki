import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kanbanSetState, kanbanNext } from '../kanban.js';
import type { KanbanDeps } from '../deps.js';
import type { PageContent, PageSummary } from '../../../../types/index.js';

const TYPES = {
  initiative: '11111111-1111-4111-8111-111111111111',
  epic: '22222222-2222-4222-8222-222222222222',
  story: '33333333-3333-4333-8333-333333333333',
  task: '44444444-4444-4444-8444-444444444444',
};

const page = (
  guid: string,
  pageType: string,
  state: string,
  extra: Partial<PageContent> = {},
): PageContent => ({
  guid,
  title: `page-${guid}`,
  content: '',
  folderId: '',
  tags: [],
  status: 'published',
  pageType,
  properties: { state: { type: 'string', value: state } },
  createdBy: 'u',
  modifiedBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
  ...extra,
});

const summary = (p: PageContent): PageSummary => ({
  guid: p.guid,
  title: p.title,
  parentGuid: p.folderId || null,
  status: 'published',
  boardOrder: p.boardOrder,
  pageType: p.pageType,
  properties: p.properties,
  tags: p.tags,
  createdBy: 'u',
  modifiedAt: p.modifiedAt,
  modifiedBy: 'u',
  hasChildren: false,
});

/** Builds deps over a flat page map, with children derived from folderId. */
function makeDeps(pages: PageContent[]) {
  const byGuid = new Map(pages.map(p => [p.guid, p]));
  // Writes land in the map: the rollup path re-reads children to decide
  // whether a parent can auto-close, so a no-op mock would never roll up.
  const updatePage = vi.fn(async (input: { pageGuid: string; properties?: Record<string, unknown>; boardOrder?: number }) => {
    const p = byGuid.get(input.pageGuid);
    if (p) {
      if (input.properties) p.properties = { ...p.properties, ...input.properties } as PageContent['properties'];
      if (input.boardOrder !== undefined) p.boardOrder = input.boardOrder;
    }
    return {};
  });
  const listChildren = vi.fn(async (parentGuid: string | null) =>
    pages.filter(p => (p.folderId || null) === parentGuid).map(summary),
  );
  const deps: KanbanDeps = {
    listChildren,
    loadPage: async (guid: string) => {
      const p = byGuid.get(guid);
      if (!p) throw new Error(`no page ${guid}`);
      return p;
    },
    listPageTypes: async () => [
      { guid: TYPES.initiative, name: 'Initiative', propertyNames: ['state'], allowedChildTypes: [TYPES.epic] },
      { guid: TYPES.epic, name: 'Epic', propertyNames: ['state'], allowedChildTypes: [TYPES.story] },
      { guid: TYPES.story, name: 'Story', propertyNames: ['state'], allowedChildTypes: [TYPES.task] },
      { guid: TYPES.task, name: 'Task', propertyNames: ['state'], allowedChildTypes: [] },
    ],
    createPage: vi.fn(),
    updatePage,
    addComment: vi.fn(async () => ({})),
    listComments: vi.fn(async () => []),
    resolveRef: async (r: string) => r,
  };
  return { deps, updatePage, listChildren };
}

const STORY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('kanban_set_state boardOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appends a destination boardOrder when the state changes', async () => {
    const target = page('t1', TYPES.task, 'In Progress', { folderId: STORY, boardOrder: 2000 });
    const { deps, updatePage } = makeDeps([
      page(STORY, TYPES.story, 'In Progress'),
      target,
      page('t2', TYPES.task, 'Done', { folderId: STORY, boardOrder: 9000 }),
    ]);

    await kanbanSetState(deps, { guid: 't1', state: 'Done' });

    expect(updatePage).toHaveBeenCalledTimes(1);
    const sent = updatePage.mock.calls[0][0] as Record<string, unknown>;
    expect(sent.properties).toEqual({ state: { type: 'string', value: 'Done' } });
    // Past the highest sibling (9000) — the card lands at the bottom of Done,
    // not at whatever rank (2000) it happened to hold in its old column.
    expect(sent.boardOrder).toBe(10000);
  });

  it('sends no boardOrder and reads no siblings when the state is unchanged', async () => {
    const { deps, updatePage, listChildren } = makeDeps([
      page(STORY, TYPES.story, 'In Progress'),
      page('t1', TYPES.task, 'Ready', { folderId: STORY, boardOrder: 2000 }),
    ]);

    await kanbanSetState(deps, { guid: 't1', state: 'Ready' });

    const sent = updatePage.mock.calls[0][0] as Record<string, unknown>;
    expect('boardOrder' in sent).toBe(false);
    expect(listChildren).not.toHaveBeenCalled();
  });

  it('still applies a tag-only change with no boardOrder when the state is unchanged', async () => {
    const { deps, updatePage } = makeDeps([
      page(STORY, TYPES.story, 'In Progress'),
      page('t1', TYPES.task, 'Ready', { folderId: STORY, boardOrder: 2000 }),
    ]);

    await kanbanSetState(deps, { guid: 't1', state: 'Ready', addTags: ['dean'] });

    const sent = updatePage.mock.calls[0][0] as Record<string, unknown>;
    expect(sent.tags).toEqual(['dean']);
    expect('boardOrder' in sent).toBe(false);
  });

  it('appends for a card that had no boardOrder at all', async () => {
    const { deps, updatePage } = makeDeps([
      page(STORY, TYPES.story, 'In Progress'),
      page('t1', TYPES.task, 'Ready', { folderId: STORY }),
    ]);

    await kanbanSetState(deps, { guid: 't1', state: 'Done' });

    // This is the poisoning case: an unordered card must not stay unordered.
    expect((updatePage.mock.calls[0][0] as Record<string, unknown>).boardOrder).toBe(1000);
  });

  it('appends on the rollup path when a parent auto-closes', async () => {
    const EPIC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const { deps, updatePage } = makeDeps([
      page(EPIC, TYPES.epic, 'In Progress'),
      page(STORY, TYPES.story, 'In Progress', { folderId: EPIC, boardOrder: 1000 }),
      page('s2', TYPES.story, 'Done', { folderId: EPIC, boardOrder: 5000 }),
      page('t1', TYPES.task, 'In Progress', { folderId: STORY, boardOrder: 1000 }),
    ]);

    await kanbanSetState(deps, { guid: 't1', state: 'Done', rollup: true });

    const storyCall = updatePage.mock.calls.find(
      c => (c[0] as { pageGuid: string }).pageGuid === STORY,
    );
    expect(storyCall).toBeDefined();
    // Auto-closed Story appends past its own siblings' max (5000).
    expect((storyCall![0] as Record<string, unknown>).boardOrder).toBe(6000);
  });
});

describe('kanban_next claim boardOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appends when claiming moves a ticket to In Progress', async () => {
    const INITIATIVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const EPIC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const { deps, updatePage } = makeDeps([
      page(INITIATIVE, TYPES.initiative, 'In Progress'),
      page(EPIC, TYPES.epic, 'In Progress', { folderId: INITIATIVE, boardOrder: 1000 }),
      page(STORY, TYPES.story, 'In Progress', { folderId: EPIC, boardOrder: 1000 }),
      page('t1', TYPES.task, 'Ready', { folderId: STORY, boardOrder: 1000 }),
      page('t2', TYPES.task, 'Ready', { folderId: STORY, boardOrder: 4000 }),
    ]);

    await kanbanNext(deps, { initiative: INITIATIVE, claim: true });

    const claimed = updatePage.mock.calls.find(
      c => (c[0] as { pageGuid: string }).pageGuid === 't1',
    );
    expect(claimed).toBeDefined();
    expect((claimed![0] as Record<string, unknown>).boardOrder).toBe(5000);
  });
});
