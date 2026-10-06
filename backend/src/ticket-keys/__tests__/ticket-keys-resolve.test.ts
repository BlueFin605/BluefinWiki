import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from '../ticket-keys-resolve.js';

vi.mock('../../middleware/auth.js', () => ({ withAuth: (fn: any) => fn }));
vi.mock('../ticket-keys-service.js', async (orig) => {
  const actual = await orig<typeof import('../ticket-keys-service.js')>();
  return { ...actual, resolveKey: vi.fn() };
});
vi.mock('../../storage/StoragePluginRegistry.js', () => ({ getStoragePlugin: vi.fn() }));

const { resolveKey } = await import('../ticket-keys-service.js');
const { getStoragePlugin } = await import('../../storage/StoragePluginRegistry.js');

const call = (key: string | undefined) =>
  (handler as any)({ pathParameters: key === undefined ? null : { key } }, {});

describe('ticket-keys-resolve', () => {
  const loadPage = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    (getStoragePlugin as any).mockReturnValue({ loadPage });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('resolves a key case-insensitively', async () => {
    (resolveKey as any).mockResolvedValue('g1');
    loadPage.mockResolvedValue({ guid: 'g1', title: 'Fix login', status: 'published' });
    const res = await call('bgt-12');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ key: 'BGT-12', guid: 'g1', title: 'Fix login' });
    expect(resolveKey).toHaveBeenCalledWith('BGT-12');
  });

  it('400 for invalid key', async () => {
    const res = await call('not a key');
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid ticket key' });
  });

  it('400 when key missing', async () => {
    expect((await call(undefined)).statusCode).toBe(400);
  });

  it('404 for unknown key', async () => {
    (resolveKey as any).mockResolvedValue(null);
    const res = await call('BGT-1');
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Ticket key not found' });
  });

  it('404 when page is gone', async () => {
    (resolveKey as any).mockResolvedValue('g1');
    loadPage.mockRejectedValue({ code: 'PAGE_NOT_FOUND' });
    expect((await call('BGT-1')).statusCode).toBe(404);
  });

  it('404 when page is deleted', async () => {
    (resolveKey as any).mockResolvedValue('g1');
    loadPage.mockResolvedValue({ guid: 'g1', title: 'x', status: 'deleted' });
    expect((await call('BGT-1')).statusCode).toBe(404);
  });

  it('500 when resolveKey throws', async () => {
    (resolveKey as any).mockRejectedValue(new Error('boom'));
    const res = await call('BGT-1');
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Failed to resolve ticket key' });
  });
});
