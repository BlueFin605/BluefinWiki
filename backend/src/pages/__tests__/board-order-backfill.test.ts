import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PageContent, PageSummary } from '../../types/index.js';

const listChildren = vi.fn();
const loadPage = vi.fn();
const savePage = vi.fn();

vi.mock('../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: () => ({ listChildren, loadPage, savePage }),
}));

import { backfillBoardOrder } from '../board-order-backfill.js';

const ROOT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

interface CardSpec {
  guid: string;
  state?: string;
  boardOrder?: number;
  modifiedAt?: string;
}

const summary = (c: CardSpec): PageSummary => ({
  guid: c.guid,
  title: c.guid,
  parentGuid: ROOT,
  status: 'published',
  ...(c.boardOrder !== undefined ? { boardOrder: c.boardOrder } : {}),
  ...(c.state ? { properties: { state: { type: 'string' as const, value: c.state } } } : {}),
  createdBy: 'u',
  modifiedAt: c.modifiedAt ?? '2026-01-01T00:00:00Z',
  modifiedBy: 'u',
  hasChildren: false,
});

const content = (c: CardSpec): PageContent => ({
  guid: c.guid,
  title: c.guid,
  content: '',
  folderId: ROOT,
  tags: [],
  status: 'published',
  ...(c.boardOrder !== undefined ? { boardOrder: c.boardOrder } : {}),
  ...(c.state ? { properties: { state: { type: 'string' as const, value: c.state } } } : {}),
  createdBy: 'u',
  modifiedBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: c.modifiedAt ?? '2026-01-01T00:00:00Z',
});

/** One parent (ROOT) holding `cards`, none of which have children. */
function tree(cards: CardSpec[]) {
  const byGuid = new Map(cards.map(c => [c.guid, c]));
  listChildren.mockImplementation(async (parent: string | null) =>
    parent === ROOT ? cards.map(summary) : [],
  );
  loadPage.mockImplementation(async (guid: string) => {
    const c = byGuid.get(guid);
    if (!c) throw new Error(`no page ${guid}`);
    return content(c);
  });
}

/** guid -> boardOrder actually written. */
const writes = (): Record<string, number | undefined> =>
  Object.fromEntries(
    savePage.mock.calls.map(c => [(c[2] as PageContent).guid, (c[2] as PageContent).boardOrder]),
  );

describe('backfillBoardOrder', () => {
  beforeEach(() => {
    // reset, not clear: clearAllMocks keeps implementations, so the
    // idempotency test's persisting savePage stub would leak into later tests.
    vi.resetAllMocks();
    loadPage.mockResolvedValue(content({ guid: ROOT }));
    listChildren.mockResolvedValue([]);
    savePage.mockResolvedValue(undefined);
  });

  it('numbers an all-unordered column 1000, 2000, 3000 in modifiedAt-descending order', async () => {
    tree([
      { guid: 'old', state: 'Ready', modifiedAt: '2026-01-01T00:00:00Z' },
      { guid: 'new', state: 'Ready', modifiedAt: '2026-03-01T00:00:00Z' },
      { guid: 'mid', state: 'Ready', modifiedAt: '2026-02-01T00:00:00Z' },
    ]);

    const result = await backfillBoardOrder(ROOT);

    // modifiedAt DESC is the order the board already displays them in, so
    // numbering must follow it to avoid reshuffling anyone's column.
    expect(writes()).toEqual({ new: 1000, mid: 2000, old: 3000 });
    expect(result.updated).toBe(3);
  });

  it('keeps ordered cards ahead of unordered ones in a mixed column', async () => {
    tree([
      { guid: 'unordered', state: 'Ready', modifiedAt: '2026-05-01T00:00:00Z' },
      { guid: 'ordered', state: 'Ready', boardOrder: 7000, modifiedAt: '2026-01-01T00:00:00Z' },
    ]);

    await backfillBoardOrder(ROOT);

    // group-by-state sorts cards that HAVE a boardOrder before all that
    // don't, regardless of modifiedAt — so 'ordered' stays first.
    expect(writes()).toEqual({ ordered: 1000, unordered: 2000 });
  });

  it('numbers each state column independently', async () => {
    tree([
      { guid: 'r1', state: 'Ready' },
      { guid: 'r2', state: 'Ready' },
      { guid: 'd1', state: 'Done' },
    ]);

    await backfillBoardOrder(ROOT);

    const w = writes();
    expect(w.d1).toBe(1000);
    expect(new Set([w.r1, w.r2])).toEqual(new Set([1000, 2000]));
  });

  it('groups cards with no state property into one column', async () => {
    tree([{ guid: 'a' }, { guid: 'b' }]);
    await backfillBoardOrder(ROOT);
    expect(new Set(Object.values(writes()))).toEqual(new Set([1000, 2000]));
  });

  it('writes nothing for an already-sequential column', async () => {
    tree([
      { guid: 'a', state: 'Ready', boardOrder: 1000 },
      { guid: 'b', state: 'Ready', boardOrder: 2000 },
    ]);

    const result = await backfillBoardOrder(ROOT);

    expect(savePage).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it('writes only the cards whose value actually changes', async () => {
    tree([
      { guid: 'a', state: 'Ready', boardOrder: 1000 },
      { guid: 'b', state: 'Ready', boardOrder: 9999 },
    ]);

    await backfillBoardOrder(ROOT);

    expect(writes()).toEqual({ b: 2000 });
  });

  it('is idempotent — a second run writes nothing', async () => {
    const cards: CardSpec[] = [
      { guid: 'a', state: 'Ready' },
      { guid: 'b', state: 'Ready' },
    ];
    tree(cards);
    // Persist the first run's values back onto the fixture, as storage would.
    savePage.mockImplementation(async (_g: string, _p: string, page: PageContent) => {
      const c = cards.find(x => x.guid === page.guid)!;
      c.boardOrder = page.boardOrder;
    });

    const first = await backfillBoardOrder(ROOT);
    expect(first.updated).toBe(2);

    savePage.mockClear();
    const second = await backfillBoardOrder(ROOT);
    expect(second.updated).toBe(0);
    expect(savePage).not.toHaveBeenCalled();
  });

  it('preserves every other field on the page it rewrites', async () => {
    tree([{ guid: 'a', state: 'Ready' }]);
    await backfillBoardOrder(ROOT);
    const written = savePage.mock.calls[0][2] as PageContent;
    expect(written).toMatchObject({
      guid: 'a',
      folderId: ROOT,
      status: 'published',
      createdAt: '2026-01-01T00:00:00Z',
      properties: { state: { type: 'string', value: 'Ready' } },
    });
  });

  it('recurses into grandchildren', async () => {
    const CHILD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    listChildren.mockImplementation(async (parent: string | null) => {
      if (parent === ROOT) return [summary({ guid: CHILD, state: 'Ready', boardOrder: 1000 })];
      if (parent === CHILD) return [summary({ guid: 'leaf', state: 'Ready' })];
      return [];
    });
    loadPage.mockImplementation(async (guid: string) => content({ guid }));

    await backfillBoardOrder(ROOT);

    expect(writes()).toEqual({ leaf: 1000 });
  });

  it('skips a column that is a single already-ordered card', async () => {
    tree([{ guid: 'a', state: 'Ready', boardOrder: 1000 }]);
    await backfillBoardOrder(ROOT);
    expect(savePage).not.toHaveBeenCalled();
  });
});
