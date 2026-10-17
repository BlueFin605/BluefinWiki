/**
 * Tests for pages-ancestors Lambda function
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
}));

vi.mock('../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: vi.fn(),
}));

const { handler } = await import('../pages-ancestors.js');
const { getStoragePlugin } = await import('../../storage/StoragePluginRegistry.js');

const event = (guid?: string): any => ({ pathParameters: guid ? { guid } : null });

describe('pages-ancestors', () => {
  let plugin: { loadPage: ReturnType<typeof vi.fn>; getAncestors: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = { loadPage: vi.fn(), getAncestors: vi.fn() };
    (getStoragePlugin as any).mockReturnValue(plugin);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns 400 when the guid is missing', async () => {
    const result = await handler(event());
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 for an unknown page instead of an empty list', async () => {
    plugin.loadPage.mockRejectedValue(Object.assign(new Error('nope'), { code: 'PAGE_NOT_FOUND' }));

    const result = await handler(event('00000000-0000-4000-8000-000000000000'));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'Page not found' });
    expect(plugin.getAncestors).not.toHaveBeenCalled();
  });

  it('returns 500 for an unexpected storage error', async () => {
    plugin.loadPage.mockRejectedValue(new Error('boom'));

    const result = await handler(event('00000000-0000-4000-8000-000000000000'));

    expect(result.statusCode).toBe(500);
  });

  it('returns 200 with the ancestors for an existing page', async () => {
    plugin.loadPage.mockResolvedValue({ guid: 'g' });
    plugin.getAncestors.mockResolvedValue([{ guid: 'p' }]);

    const result = await handler(event('g'));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ guid: 'g', ancestors: [{ guid: 'p' }] });
  });

  it('returns 200 with an empty list for a root page', async () => {
    plugin.loadPage.mockResolvedValue({ guid: 'g' });
    plugin.getAncestors.mockResolvedValue([]);

    const result = await handler(event('g'));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).ancestors).toEqual([]);
  });
});
