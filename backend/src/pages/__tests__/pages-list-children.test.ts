import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from '../pages-list-children.js';
import type { StoragePlugin } from '../../storage/StoragePlugin.js';
import type { PageSummary } from '../../types/index.js';

vi.mock('../../storage/StoragePluginRegistry.js', () => ({
  getStoragePlugin: vi.fn(),
}));

vi.mock('../../middleware/auth.js', () => ({
  withAuth: (fn: any) => fn,
  getUserContext: () => ({
    userId: 'user-1',
    email: 'user@example.com',
    role: 'Admin',
    displayName: 'Test User',
  }),
}));

const { getStoragePlugin } = await import('../../storage/StoragePluginRegistry.js');

const PARENT_GUID = '550e8400-e29b-41d4-a716-446655440000';
const TYPE_GUID = '11111111-1111-4111-8111-111111111111';

function makeEvent(query: Record<string, string> = {}): any {
  return {
    pathParameters: { guid: PARENT_GUID },
    queryStringParameters: query,
  };
}

function makeSummary(overrides: Partial<PageSummary> & { guid: string }): PageSummary {
  return {
    title: 'Untitled',
    parentGuid: PARENT_GUID,
    status: 'published',
    createdBy: 'user-1',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'user-1',
    hasChildren: false,
    ...overrides,
  };
}

describe('pages-list-children', () => {
  let mockPlugin: Partial<StoragePlugin>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlugin = {
      loadPage: vi.fn().mockResolvedValue({ guid: PARENT_GUID, title: 'Parent' }),
      listChildren: vi.fn(),
    };
    (getStoragePlugin as any).mockReturnValue(mockPlugin);
  });

  describe('standard listing with include=properties', () => {
    it('uses pageType/properties already returned by listChildren instead of re-fetching each child', async () => {
      const child = makeSummary({
        guid: 'child-1',
        pageType: 'type-a',
        properties: { state: { type: 'string', value: 'Done' } },
      });
      (mockPlugin.listChildren as any).mockResolvedValue([child]);

      const result = await handler(makeEvent({ include: 'properties' }), {} as any);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.children).toHaveLength(1);
      expect(body.children[0].pageType).toBe('type-a');
      expect(body.children[0].properties).toEqual({ state: { type: 'string', value: 'Done' } });
      // The only loadPage call should be the parent-existence check — no
      // second fetch per child now that listChildren already carries
      // pageType/properties.
      expect(mockPlugin.loadPage).toHaveBeenCalledTimes(1);
      expect(mockPlugin.loadPage).toHaveBeenCalledWith(PARENT_GUID);
    });
  });

  describe('standard listing without include=properties', () => {
    it('does not leak the properties field when the caller did not ask for it', async () => {
      const child = makeSummary({
        guid: 'child-1',
        pageType: 'type-a',
        properties: { state: { type: 'string', value: 'Done' } },
      });
      (mockPlugin.listChildren as any).mockResolvedValue([child]);

      const result = await handler(makeEvent(), {} as any);

      const body = JSON.parse(result.body);
      expect(body.children).toHaveLength(1);
      expect(body.children[0].properties).toBeUndefined();
    });
  });

  describe('deep fetch by type', () => {
    it('uses properties already present on matched children instead of re-fetching them', async () => {
      const matchChild = makeSummary({
        guid: 'match-1',
        pageType: TYPE_GUID,
        properties: { state: { type: 'string', value: 'In Progress' } },
      });
      (mockPlugin.listChildren as any).mockResolvedValue([matchChild]);

      const result = await handler(
        makeEvent({ include: 'properties', type: TYPE_GUID, depth: '2' }),
        {} as any,
      );

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.children).toHaveLength(1);
      expect(body.children[0].properties).toEqual({ state: { type: 'string', value: 'In Progress' } });
      expect(body.children[0].parentTitle).toBe('Parent');
      // Only the parent-verification loadPage call — matched children's
      // properties come from listChildren, not a second per-match loadPage.
      expect(mockPlugin.loadPage).toHaveBeenCalledTimes(1);
    });

    it('carries ticketKey through the deep-board mapping and the standard listing', async () => {
      const keyed = makeSummary({ guid: 'k', pageType: TYPE_GUID, ticketKey: 'BGT-3' });
      (mockPlugin.listChildren as any).mockResolvedValue([keyed]);

      const deep = await handler(
        makeEvent({ include: 'properties', type: TYPE_GUID, depth: '2' }),
        {} as any,
      );
      expect(JSON.parse(deep.body).children[0].ticketKey).toBe('BGT-3');

      const flat = await handler(makeEvent(), {} as any);
      expect(JSON.parse(flat.body).children[0].ticketKey).toBe('BGT-3');
    });

    const TYPE_B = '22222222-2222-4222-8222-222222222222';

    it('matches any of several comma-separated types', async () => {
      const a = makeSummary({ guid: 'a', pageType: TYPE_GUID });
      const b = makeSummary({ guid: 'b', pageType: TYPE_B });
      const other = makeSummary({ guid: 'o', pageType: 'other-type' });
      (mockPlugin.listChildren as any).mockResolvedValue([a, b, other]);

      const result = await handler(
        makeEvent({ include: 'properties', type: `${TYPE_GUID},${TYPE_B}`, depth: '2' }),
        {} as any,
      );

      const body = JSON.parse(result.body);
      expect(body.children.map((c: any) => c.guid)).toEqual(['a', 'b']);
    });

    it('filters by type at depth 1 too (previously ignored the type)', async () => {
      const a = makeSummary({ guid: 'a', pageType: TYPE_GUID });
      const other = makeSummary({ guid: 'o', pageType: 'other-type' });
      (mockPlugin.listChildren as any).mockResolvedValue([a, other]);

      const result = await handler(
        makeEvent({ include: 'properties', type: TYPE_GUID, depth: '1' }),
        {} as any,
      );

      const body = JSON.parse(result.body);
      expect(body.children.map((c: any) => c.guid)).toEqual(['a']);
      expect(body.children[0].parentTitle).toBe('Parent');
    });

    it('treats an empty type list as no filter', async () => {
      const a = makeSummary({ guid: 'a', pageType: TYPE_GUID });
      const other = makeSummary({ guid: 'o', pageType: 'other-type' });
      (mockPlugin.listChildren as any).mockResolvedValue([a, other]);

      const result = await handler(makeEvent({ include: 'properties', type: ' , ' }), {} as any);

      const body = JSON.parse(result.body);
      expect(body.children.map((c: any) => c.guid)).toEqual(['a', 'o']);
    });
  });

  describe('page size ceiling', () => {
    it('honors a limit above the old 500 cap, up to the new ceiling', async () => {
      const children = Array.from({ length: 600 }, (_, i) => makeSummary({ guid: `child-${i}` }));
      (mockPlugin.listChildren as any).mockResolvedValue(children);

      const result = await handler(makeEvent({ limit: '800' }), {} as any);
      const body = JSON.parse(result.body);

      expect(body.children).toHaveLength(600);
      expect(body.hasMore).toBe(false);
    });

    it('still clamps a limit beyond the new ceiling', async () => {
      const children = Array.from({ length: 1500 }, (_, i) => makeSummary({ guid: `child-${i}` }));
      (mockPlugin.listChildren as any).mockResolvedValue(children);

      const result = await handler(makeEvent({ limit: '5000' }), {} as any);
      const body = JSON.parse(result.body);

      expect(body.children.length).toBeLessThanOrEqual(1000);
      expect(body.hasMore).toBe(true);
    });
  });
});
