import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../ticket-keys-store.js');
vi.mock('../../storage/StoragePluginRegistry.js', () => ({ getStoragePlugin: vi.fn() }));
vi.mock('../../page-types/page-types-service.js', () => ({ listPageTypes: vi.fn() }));

import { allocateNumber, putMapping } from '../ticket-keys-store.js';
import { getStoragePlugin } from '../../storage/StoragePluginRegistry.js';
import { listPageTypes } from '../../page-types/page-types-service.js';
import { backfillTicketKeys, BackfillError } from '../ticket-keys-backfill.js';

type FakePage = {
  guid: string;
  folderId: string;
  pageType?: string;
  createdAt: string;
  ticketKey?: string;
  boardConfig?: { keyPrefix?: string };
};

const types = [
  { guid: 't-init', name: 'Initiative', properties: [{ name: 'state' }] },
  { guid: 't-task', name: 'Task', properties: [{ name: 'state' }] },
  { guid: 't-note', name: 'Note', properties: [] },
];

let pages: Record<string, FakePage>;
let mappings: Map<string, string>;
let counter: number;
let errorSpy: ReturnType<typeof vi.spyOn>;
const savePage = vi.fn();

const add = (p: Partial<FakePage> & { guid: string }) => {
  pages[p.guid] = { folderId: '', createdAt: '2026-01-01T00:00:00Z', ...p };
};

beforeEach(() => {
  vi.resetAllMocks();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  pages = {};
  mappings = new Map();
  counter = 0;
  add({ guid: 'init', pageType: 't-init', boardConfig: { keyPrefix: 'BGT' } });

  savePage.mockImplementation(async (guid: string, _parent: string | null, content: FakePage) => {
    pages[guid] = content;
  });
  vi.mocked(getStoragePlugin).mockReturnValue({
    loadPage: async (g: string) => {
      if (!pages[g]) throw Object.assign(new Error(`not found ${g}`), { code: 'PAGE_NOT_FOUND' });
      return { ...pages[g] };
    },
    listChildren: async (parent: string | null) =>
      Object.values(pages)
        .filter((p) => (p.folderId || null) === parent)
        .map((p) => ({ guid: p.guid, pageType: p.pageType, ticketKey: p.ticketKey })),
    savePage,
  } as never);
  vi.mocked(listPageTypes).mockResolvedValue(types as never);
  vi.mocked(allocateNumber).mockImplementation(async () => ++counter);
  vi.mocked(putMapping).mockImplementation(async (key: string, guid: string) => {
    const other = mappings.get(key);
    if (other === undefined) {
      mappings.set(key, guid);
      return 'created';
    }
    if (other === guid) return 'exists';
    throw new Error(`${key} already maps to ${other}`);
  });
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('backfillTicketKeys', () => {
  it('assigns keys to unkeyed tickets in createdAt order across the whole tree (tie → guid)', async () => {
    add({ guid: 'a', folderId: 'init', pageType: 't-task', createdAt: '2026-01-03T00:00:00Z' });
    add({ guid: 'b', folderId: 'init', pageType: 't-task', createdAt: '2026-01-01T00:00:00Z' });
    add({ guid: 'c', folderId: 'b', pageType: 't-task', createdAt: '2026-01-02T00:00:00Z' });
    add({ guid: 'e', folderId: 'b', pageType: 't-task', createdAt: '2026-01-04T00:00:00Z' });
    add({ guid: 'd', folderId: 'b', pageType: 't-task', createdAt: '2026-01-04T00:00:00Z' });

    expect(await backfillTicketKeys('init')).toEqual({ assigned: 5, repaired: 0 });

    expect(pages.b.ticketKey).toBe('BGT-1');
    expect(pages.c.ticketKey).toBe('BGT-2');
    expect(pages.a.ticketKey).toBe('BGT-3');
    expect(pages.d.ticketKey).toBe('BGT-4');
    expect(pages.e.ticketKey).toBe('BGT-5');
    expect(allocateNumber).toHaveBeenCalledWith('BGT');
    expect(savePage).toHaveBeenCalledWith('c', 'b', expect.objectContaining({ guid: 'c', ticketKey: 'BGT-2' }));
    expect(mappings.get('BGT-2')).toBe('c');
  });

  it('repairs a keyed page whose mapping is missing', async () => {
    add({ guid: 'k', folderId: 'init', pageType: 't-task', ticketKey: 'BGT-9' });
    expect(await backfillTicketKeys('init')).toEqual({ assigned: 0, repaired: 1 });
    expect(mappings.get('BGT-9')).toBe('k');
    expect(savePage).not.toHaveBeenCalled();
    expect(allocateNumber).not.toHaveBeenCalled();
  });

  it('does not count a keyed page whose mapping already exists', async () => {
    add({ guid: 'k', folderId: 'init', pageType: 't-task', ticketKey: 'BGT-9' });
    mappings.set('BGT-9', 'k');
    expect(await backfillTicketKeys('init')).toEqual({ assigned: 0, repaired: 0 });
  });

  it('ignores non-ticket children and does not descend into them', async () => {
    add({ guid: 'note', folderId: 'init', pageType: 't-note' });
    add({ guid: 'wiki', folderId: 'init' });
    add({ guid: 'under-note', folderId: 'note', pageType: 't-task' });
    add({ guid: 'under-wiki', folderId: 'wiki', pageType: 't-task' });
    expect(await backfillTicketKeys('init')).toEqual({ assigned: 0, repaired: 0 });
    expect(savePage).not.toHaveBeenCalled();
  });

  it('logs a mapping conflict on a keyed page and continues', async () => {
    add({ guid: 'k', folderId: 'init', pageType: 't-task', ticketKey: 'BGT-1', createdAt: '2026-01-01T00:00:00Z' });
    add({ guid: 'u', folderId: 'init', pageType: 't-task', createdAt: '2026-01-02T00:00:00Z' });
    mappings.set('BGT-1', 'someone-else');
    counter = 1;
    expect(await backfillTicketKeys('init')).toEqual({ assigned: 1, repaired: 0 });
    expect(errorSpy).toHaveBeenCalled();
    expect(pages.u.ticketKey).toBe('BGT-2');
  });

  it('is idempotent: a second run assigns and repairs nothing', async () => {
    add({ guid: 'a', folderId: 'init', pageType: 't-task' });
    add({ guid: 'b', folderId: 'a', pageType: 't-task' });
    add({ guid: 'k', folderId: 'init', pageType: 't-task', ticketKey: 'BGT-50' });
    expect(await backfillTicketKeys('init')).toEqual({ assigned: 2, repaired: 1 });
    savePage.mockClear();
    expect(await backfillTicketKeys('init')).toEqual({ assigned: 0, repaired: 0 });
    expect(savePage).not.toHaveBeenCalled();
  });

  it('rejects a page that is not an Initiative', async () => {
    add({ guid: 'task', pageType: 't-task' });
    add({ guid: 'plain' });
    await expect(backfillTicketKeys('task')).rejects.toEqual(new BackfillError('Not an Initiative', 400));
    await expect(backfillTicketKeys('plain')).rejects.toBeInstanceOf(BackfillError);
  });

  it('rejects an Initiative with no keyPrefix', async () => {
    add({ guid: 'bare', pageType: 't-init' });
    const err = await backfillTicketKeys('bare').catch((e) => e);
    expect(err).toBeInstanceOf(BackfillError);
    expect(err.message).toBe('Initiative has no keyPrefix');
    expect(err.statusCode).toBe(400);
  });

  it('propagates PAGE_NOT_FOUND for a missing initiative', async () => {
    await expect(backfillTicketKeys('nope')).rejects.toMatchObject({ code: 'PAGE_NOT_FOUND' });
  });
});
