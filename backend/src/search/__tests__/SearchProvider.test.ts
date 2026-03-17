/**
 * Unit Tests for Search Provider Interface
 * Task 8.1: Verify ISearchProvider contract
 */

import { describe, it, expect, vi } from 'vitest';
import type { ISearchProvider } from '../SearchProvider.js';
import type {
  SearchQuery,
  SearchResultSet,
  SearchCapabilities,
} from '../SearchTypes.js';

/**
 * Mock search provider for testing the interface contract
 */
class MockSearchProvider implements ISearchProvider {
  private indexedPages: Map<string, { title: string; content: string; metadata: Record<string, unknown> }> = new Map();
  public indexPageSpy = vi.fn();
  public searchSpy = vi.fn();
  public deletePageSpy = vi.fn();
  public reindexAllSpy = vi.fn();

  async indexPage(
    pageId: string,
    title: string,
    content: string,
    metadata: { tags: string[]; path: string; author: string; modifiedDate: string; shortCode?: string }
  ): Promise<void> {
    this.indexPageSpy(pageId, title, content, metadata);
    this.indexedPages.set(pageId, { title, content, metadata });
  }

  async search(query: SearchQuery): Promise<SearchResultSet> {
    this.searchSpy(query);
    const start = Date.now();
    const results = Array.from(this.indexedPages.entries())
      .filter(([, page]) =>
        page.title.toLowerCase().includes(query.text.toLowerCase()) ||
        page.content.toLowerCase().includes(query.text.toLowerCase())
      )
      .slice(query.offset, query.offset + query.limit)
      .map(([pageId, page]) => ({
        pageId,
        title: page.title,
        snippet: page.content.substring(0, 200),
        relevanceScore: 100,
        matchCount: 1,
        path: (page.metadata as { path: string }).path,
        tags: (page.metadata as { tags: string[] }).tags,
      }));

    return {
      results,
      totalResults: results.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async deletePage(pageId: string): Promise<void> {
    this.deletePageSpy(pageId);
    this.indexedPages.delete(pageId);
  }

  async reindexAll(
    pages: Array<{
      pageId: string;
      title: string;
      content: string;
      metadata: { tags: string[]; path: string; author: string; modifiedDate: string; shortCode?: string };
    }>
  ): Promise<void> {
    this.reindexAllSpy(pages);
    this.indexedPages.clear();
    for (const page of pages) {
      this.indexedPages.set(page.pageId, {
        title: page.title,
        content: page.content,
        metadata: page.metadata,
      });
    }
  }

  getCapabilities(): SearchCapabilities {
    return {
      fuzzySearch: false,
      faceting: false,
      highlighting: false,
      estimatedMonthlyCost: 0,
    };
  }

  getType(): string {
    return 'mock';
  }
}

describe('ISearchProvider interface contract', () => {
  let provider: MockSearchProvider;

  beforeEach(() => {
    provider = new MockSearchProvider();
  });

  describe('indexPage()', () => {
    it('should index a page with all metadata', async () => {
      await provider.indexPage('page-1', 'Test Page', '# Test\nSome content', {
        tags: ['test'],
        path: 'Test Page',
        author: 'user-123',
        modifiedDate: '2026-03-17T12:00:00Z',
        shortCode: 'TP',
      });

      expect(provider.indexPageSpy).toHaveBeenCalledWith(
        'page-1',
        'Test Page',
        '# Test\nSome content',
        {
          tags: ['test'],
          path: 'Test Page',
          author: 'user-123',
          modifiedDate: '2026-03-17T12:00:00Z',
          shortCode: 'TP',
        }
      );
    });

    it('should index a page without optional shortCode', async () => {
      await provider.indexPage('page-2', 'Another Page', 'Content', {
        tags: [],
        path: 'Another Page',
        author: 'user-456',
        modifiedDate: '2026-03-17T12:00:00Z',
      });

      expect(provider.indexPageSpy).toHaveBeenCalledOnce();
    });

    it('should allow re-indexing the same page (update)', async () => {
      await provider.indexPage('page-1', 'Original', 'v1', {
        tags: [],
        path: 'Original',
        author: 'user-123',
        modifiedDate: '2026-03-17T12:00:00Z',
      });

      await provider.indexPage('page-1', 'Updated', 'v2', {
        tags: ['updated'],
        path: 'Updated',
        author: 'user-123',
        modifiedDate: '2026-03-17T13:00:00Z',
      });

      expect(provider.indexPageSpy).toHaveBeenCalledTimes(2);

      // Search should find the updated version
      const results = await provider.search({
        text: 'Updated',
        limit: 10,
        offset: 0,
      });
      expect(results.results).toHaveLength(1);
      expect(results.results[0].title).toBe('Updated');
    });
  });

  describe('search()', () => {
    beforeEach(async () => {
      await provider.indexPage('page-1', 'Family Recipes', 'Italian pasta and pizza recipes', {
        tags: ['recipe', 'italian'],
        path: 'Cooking > Family Recipes',
        author: 'user-123',
        modifiedDate: '2026-03-17T12:00:00Z',
      });
      await provider.indexPage('page-2', 'Vacation Plans', 'Trip to Italy in summer', {
        tags: ['travel'],
        path: 'Travel > Vacation Plans',
        author: 'user-456',
        modifiedDate: '2026-03-16T12:00:00Z',
      });
      await provider.indexPage('page-3', 'School Notes', 'Mathematics homework', {
        tags: ['school'],
        path: 'School > School Notes',
        author: 'user-789',
        modifiedDate: '2026-03-15T12:00:00Z',
      });
    });

    it('should return matching results for a query', async () => {
      const results = await provider.search({
        text: 'Italy',
        limit: 10,
        offset: 0,
      });

      expect(results.results.length).toBeGreaterThanOrEqual(1);
      expect(results.totalResults).toBeGreaterThanOrEqual(1);
      expect(results.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return empty results for non-matching query', async () => {
      const results = await provider.search({
        text: 'xyznonexistent',
        limit: 10,
        offset: 0,
      });

      expect(results.results).toHaveLength(0);
      expect(results.totalResults).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const results = await provider.search({
        text: '',
        limit: 1,
        offset: 0,
      });

      // The mock filters on text match, but with empty string all match
      // This tests that limit is applied
      expect(results.results.length).toBeLessThanOrEqual(1);
    });

    it('should respect offset parameter', async () => {
      const allResults = await provider.search({
        text: '',
        limit: 10,
        offset: 0,
      });

      const offsetResults = await provider.search({
        text: '',
        limit: 10,
        offset: 1,
      });

      expect(offsetResults.results.length).toBe(allResults.results.length - 1);
    });

    it('should return SearchResultSet with correct shape', async () => {
      const resultSet = await provider.search({
        text: 'Recipe',
        limit: 10,
        offset: 0,
      });

      expect(resultSet).toHaveProperty('results');
      expect(resultSet).toHaveProperty('totalResults');
      expect(resultSet).toHaveProperty('executionTimeMs');
      expect(Array.isArray(resultSet.results)).toBe(true);
      expect(typeof resultSet.totalResults).toBe('number');
      expect(typeof resultSet.executionTimeMs).toBe('number');

      if (resultSet.results.length > 0) {
        const result = resultSet.results[0];
        expect(result).toHaveProperty('pageId');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('snippet');
        expect(result).toHaveProperty('relevanceScore');
        expect(result).toHaveProperty('matchCount');
        expect(result).toHaveProperty('path');
        expect(result).toHaveProperty('tags');
      }
    });
  });

  describe('deletePage()', () => {
    it('should remove a page from the index', async () => {
      await provider.indexPage('page-1', 'Test Page', 'content', {
        tags: [],
        path: 'Test Page',
        author: 'user-123',
        modifiedDate: '2026-03-17T12:00:00Z',
      });

      await provider.deletePage('page-1');

      expect(provider.deletePageSpy).toHaveBeenCalledWith('page-1');

      const results = await provider.search({
        text: 'Test Page',
        limit: 10,
        offset: 0,
      });
      expect(results.results).toHaveLength(0);
    });

    it('should not throw when deleting non-existent page', async () => {
      await expect(provider.deletePage('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('reindexAll()', () => {
    it('should replace entire index with new pages', async () => {
      // Index some pages
      await provider.indexPage('old-1', 'Old Page', 'old content', {
        tags: [],
        path: 'Old Page',
        author: 'user-123',
        modifiedDate: '2026-03-17T12:00:00Z',
      });

      // Reindex with new pages
      await provider.reindexAll([
        {
          pageId: 'new-1',
          title: 'New Page 1',
          content: 'new content 1',
          metadata: {
            tags: ['new'],
            path: 'New Page 1',
            author: 'user-456',
            modifiedDate: '2026-03-17T13:00:00Z',
          },
        },
        {
          pageId: 'new-2',
          title: 'New Page 2',
          content: 'new content 2',
          metadata: {
            tags: ['new'],
            path: 'New Page 2',
            author: 'user-789',
            modifiedDate: '2026-03-17T13:00:00Z',
          },
        },
      ]);

      // Old page should be gone
      const oldResults = await provider.search({
        text: 'Old Page',
        limit: 10,
        offset: 0,
      });
      expect(oldResults.results).toHaveLength(0);

      // New pages should be findable
      const newResults = await provider.search({
        text: 'New Page',
        limit: 10,
        offset: 0,
      });
      expect(newResults.results).toHaveLength(2);
    });

    it('should handle empty reindex', async () => {
      await provider.indexPage('page-1', 'Test', 'content', {
        tags: [],
        path: 'Test',
        author: 'user-123',
        modifiedDate: '2026-03-17T12:00:00Z',
      });

      await provider.reindexAll([]);

      const results = await provider.search({
        text: '',
        limit: 10,
        offset: 0,
      });
      expect(results.results).toHaveLength(0);
    });
  });

  describe('getCapabilities()', () => {
    it('should return capabilities object', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities).toHaveProperty('fuzzySearch');
      expect(capabilities).toHaveProperty('faceting');
      expect(capabilities).toHaveProperty('highlighting');
      expect(capabilities).toHaveProperty('estimatedMonthlyCost');
      expect(typeof capabilities.fuzzySearch).toBe('boolean');
      expect(typeof capabilities.faceting).toBe('boolean');
      expect(typeof capabilities.highlighting).toBe('boolean');
      expect(typeof capabilities.estimatedMonthlyCost).toBe('number');
    });
  });

  describe('getType()', () => {
    it('should return the provider type string', () => {
      expect(provider.getType()).toBe('mock');
    });
  });
});
