import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
  getUserContext: () => ({ userId: 'u', role: 'Admin' }),
}));
vi.mock('../../ticket-keys/ticket-keys-service.js', async (orig) => {
  const actual = await orig<typeof import('../../ticket-keys/ticket-keys-service.js')>();
  return { ...actual, resolveKey: vi.fn() };
});
vi.mock('../../storage/StoragePluginRegistry.js', () => ({ getStoragePlugin: vi.fn() }));

const { handler } = await import('../links-resolve.js');
const { resolveKey } = await import('../../ticket-keys/ticket-keys-service.js');
const { getStoragePlugin } = await import('../../storage/StoragePluginRegistry.js');

const GUID = '3f2b8a0e-5c1d-4e7a-9b36-1a2b3c4d5e6f';
const ticket = {
  guid: GUID, title: 'Fix login', folderId: '', status: 'published',
  createdBy: 'u', modifiedBy: 'u', createdAt: '', modifiedAt: '',
};

const call = async (query: string) => {
  const res = await (handler as any)({ body: JSON.stringify({ query }) }, {});
  return { status: res.statusCode, body: JSON.parse(res.body) };
};

describe('links-resolve with a ticket key', () => {
  const loadPage = vi.fn();
  const listChildren = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    (getStoragePlugin as any).mockReturnValue({ loadPage, listChildren });
  });

  it('resolves [[bgt-12]] to the keyed page as an exact match', async () => {
    (resolveKey as any).mockResolvedValue(GUID);
    loadPage.mockResolvedValue(ticket);
    const { status, body } = await call('bgt-12');
    expect(status).toBe(200);
    expect(resolveKey).toHaveBeenCalledWith('bgt-12');
    expect(loadPage).toHaveBeenCalledWith(GUID);
    expect(body).toMatchObject({ query: 'bgt-12', exactMatch: true, exists: true, matches: [{ guid: GUID, title: 'Fix login' }] });
    expect(listChildren).not.toHaveBeenCalled();
  });

  it('falls back to title search for an unknown key', async () => {
    (resolveKey as any).mockResolvedValue(null);
    listChildren.mockResolvedValue([
      { guid: 'g-titled', title: 'NOPE-9', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: 'u', hasChildren: false },
    ]);
    const { status, body } = await call('NOPE-9');
    expect(status).toBe(200);
    expect(loadPage).not.toHaveBeenCalled();
    expect(body.matches[0]).toMatchObject({ guid: 'g-titled', title: 'NOPE-9' });
  });

  it('does not look up plain titles as keys', async () => {
    listChildren.mockResolvedValue([]);
    await call('Fix login');
    expect(resolveKey).not.toHaveBeenCalled();
  });
});
