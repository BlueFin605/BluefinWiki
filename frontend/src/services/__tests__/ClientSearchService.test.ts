/**
 * Unit Tests for ClientSearchService
 * Task 8.2: Client-side search with Fuse.js
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClientSearchService } from '../ClientSearchService';
import type { ClientSearchIndex, WikiSearchQuery } from '../../types/search';

// Sample test index
const createTestIndex = (): ClientSearchIndex => ({
  version: 1,
  builtAt: '2026-03-17T12:00:00Z',
  totalPages: 5,
  entries: [
    {
      id: 'page-1',
      title: 'Family Recipes',
      content: 'Italian pasta and pizza recipes for the whole family. Grandma\'s secret sauce.',
      tags: ['recipe', 'italian', 'family'],
      path: 'Cooking > Family Recipes',
      modifiedDate: '2026-03-17T12:00:00Z',
      author: 'user-123',
    },
    {
      id: 'page-2',
      title: 'Vacation Plans 2026',
      content: 'Planning our summer trip to Italy. Rome, Florence, and Venice itinerary.',
      tags: ['travel', 'italy'],
      path: 'Travel > Vacation Plans 2026',
      modifiedDate: '2026-03-16T12:00:00Z',
      author: 'user-456',
    },
    {
      id: 'page-3',
      title: 'School Notes - Mathematics',
      content: 'Algebra homework and calculus study notes. Quadratic equations and derivatives.',
      tags: ['school', 'math'],
      path: 'School > School Notes - Mathematics',
      modifiedDate: '2026-03-15T12:00:00Z',
      author: 'user-789',
    },
    {
      id: 'page-4',
      title: 'Getting Started',
      content: 'Welcome to our family wiki. This guide helps you get started with creating pages.',
      tags: ['guide', 'onboarding'],
      path: 'Getting Started',
      modifiedDate: '2026-03-14T12:00:00Z',
      author: 'user-123',
    },
    {
      id: 'page-5',
      title: 'Italian Desserts',
      content: 'Tiramisu, panna cotta, and gelato recipes from our Italy trip.',
      tags: ['recipe', 'italian', 'dessert'],
      path: 'Cooking > Italian Desserts',
      modifiedDate: '2026-03-13T12:00:00Z',
      author: 'user-123',
    },
  ],
});

describe('ClientSearchService', () => {
  let service: ClientSearchService;

  beforeEach(() => {
    service = new ClientSearchService();
    service.setIndex(createTestIndex());
  });

  afterEach(() => {
    service.dispose();
  });

  describe('setIndex()', () => {
    it('should load the index and mark as loaded', () => {
      expect(service.isIndexLoaded()).toBe(true);
    });

    it('should return index metadata', () => {
      const info = service.getIndexInfo();
      expect(info).toEqual({
        version: 1,
        builtAt: '2026-03-17T12:00:00Z',
        totalPages: 5,
      });
    });
  });

  describe('search()', () => {
    const baseQuery: WikiSearchQuery = {
      text: '',
      scope: 'all',
      titleOnly: false,
      limit: 10,
      offset: 0,
    };

    it('should return empty results for empty query', async () => {
      const results = await service.search({ ...baseQuery, text: '' });
      expect(results.results).toHaveLength(0);
      expect(results.totalResults).toBe(0);
    });

    it('should find pages by title match', async () => {
      const results = await service.search({ ...baseQuery, text: 'Family Recipes' });
      expect(results.results.length).toBeGreaterThanOrEqual(1);
      expect(results.results[0].title).toBe('Family Recipes');
    });

    it('should find pages by content match', async () => {
      const results = await service.search({ ...baseQuery, text: 'Tiramisu' });
      expect(results.results.length).toBeGreaterThanOrEqual(1);
      expect(results.results.some(r => r.pageId === 'page-5')).toBe(true);
    });

    it('should find pages by tag match', async () => {
      const results = await service.search({ ...baseQuery, text: 'italian' });
      expect(results.results.length).toBeGreaterThanOrEqual(2);
    });

    it('should return relevance scores', async () => {
      const results = await service.search({ ...baseQuery, text: 'recipe' });
      expect(results.results.length).toBeGreaterThanOrEqual(1);
      results.results.forEach(r => {
        expect(r.relevanceScore).toBeGreaterThan(0);
        expect(r.relevanceScore).toBeLessThanOrEqual(1000);
      });
    });

    it('should return results sorted by relevance (highest first)', async () => {
      const results = await service.search({ ...baseQuery, text: 'italian' });
      for (let i = 1; i < results.results.length; i++) {
        expect(results.results[i].relevanceScore).toBeLessThanOrEqual(
          results.results[i - 1].relevanceScore
        );
      }
    });

    it('should return snippets', async () => {
      const results = await service.search({ ...baseQuery, text: 'pasta' });
      expect(results.results.length).toBeGreaterThanOrEqual(1);
      const result = results.results.find(r => r.pageId === 'page-1');
      expect(result?.snippet).toBeTruthy();
      expect(result?.snippet.length).toBeGreaterThan(0);
    });

    it('should include match counts', async () => {
      const results = await service.search({ ...baseQuery, text: 'recipe' });
      expect(results.results.length).toBeGreaterThanOrEqual(1);
      results.results.forEach(r => {
        expect(r.matchCount).toBeGreaterThanOrEqual(0);
      });
    });

    it('should include path in results', async () => {
      const results = await service.search({ ...baseQuery, text: 'Family Recipes' });
      const result = results.results.find(r => r.pageId === 'page-1');
      expect(result?.path).toBe('Cooking > Family Recipes');
    });

    it('should include tags in results', async () => {
      const results = await service.search({ ...baseQuery, text: 'Family Recipes' });
      const result = results.results.find(r => r.pageId === 'page-1');
      expect(result?.tags).toEqual(['recipe', 'italian', 'family']);
    });

    it('should include execution time', async () => {
      const results = await service.search({ ...baseQuery, text: 'test' });
      expect(results.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return empty results for non-matching query', async () => {
      const results = await service.search({ ...baseQuery, text: 'xyznonexistent12345' });
      expect(results.results).toHaveLength(0);
    });
  });

  describe('title-only search', () => {
    const baseQuery: WikiSearchQuery = {
      text: '',
      scope: 'all',
      titleOnly: true,
      limit: 10,
      offset: 0,
    };

    it('should only match titles when titleOnly is true', async () => {
      // "Tiramisu" is in content of page-5 but not in title
      const results = await service.search({ ...baseQuery, text: 'Tiramisu' });
      expect(results.results).toHaveLength(0);
    });

    it('should match titles when titleOnly is true', async () => {
      const results = await service.search({ ...baseQuery, text: 'Getting Started' });
      expect(results.results.length).toBeGreaterThanOrEqual(1);
      expect(results.results[0].title).toBe('Getting Started');
    });
  });

  describe('folder-scoped search', () => {
    const baseQuery: WikiSearchQuery = {
      text: '',
      scope: 'all',
      titleOnly: false,
      limit: 10,
      offset: 0,
    };

    it('should filter results by folder scope', async () => {
      const results = await service.search({
        ...baseQuery,
        text: 'recipe',
        scope: 'Cooking',
      });

      results.results.forEach(r => {
        expect(r.path).toMatch(/^Cooking/);
      });
    });

    it('should return all results when scope is "all"', async () => {
      const results = await service.search({
        ...baseQuery,
        text: 'italian',
        scope: 'all',
      });

      // Should find results from both Cooking and Travel
      const paths = results.results.map(r => r.path);
      expect(paths.some(p => p.startsWith('Cooking'))).toBe(true);
    });

    it('should return empty results when scope matches no pages', async () => {
      const results = await service.search({
        ...baseQuery,
        text: 'recipe',
        scope: 'NonexistentFolder',
      });

      expect(results.results).toHaveLength(0);
    });
  });

  describe('pagination', () => {
    const baseQuery: WikiSearchQuery = {
      text: '',
      scope: 'all',
      titleOnly: false,
      limit: 2,
      offset: 0,
    };

    it('should respect limit parameter', async () => {
      const results = await service.search({
        ...baseQuery,
        text: 'recipe italian',
        limit: 1,
      });

      expect(results.results.length).toBeLessThanOrEqual(1);
    });

    it('should respect offset parameter', async () => {
      const allResults = await service.search({
        ...baseQuery,
        text: 'italian',
        limit: 10,
        offset: 0,
      });

      if (allResults.totalResults > 1) {
        const offsetResults = await service.search({
          ...baseQuery,
          text: 'italian',
          limit: 10,
          offset: 1,
        });

        expect(offsetResults.results.length).toBe(allResults.results.length - 1);
      }
    });

    it('should report totalResults regardless of pagination', async () => {
      const results = await service.search({
        ...baseQuery,
        text: 'italian',
        limit: 1,
        offset: 0,
      });

      // totalResults should reflect all matches, not just the page
      expect(results.totalResults).toBeGreaterThanOrEqual(results.results.length);
    });
  });

  describe('loadIndex()', () => {
    it('should fetch index from URL', async () => {
      const freshService = new ClientSearchService('/test-url');
      const mockIndex = createTestIndex();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIndex),
      });

      await freshService.loadIndex();

      expect(freshService.isIndexLoaded()).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/test-url');

      freshService.dispose();
    });

    it('should throw when fetch fails and no cached index', async () => {
      const freshService = new ClientSearchService('/bad-url');

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(freshService.loadIndex()).rejects.toThrow('Failed to fetch search index: 404');

      freshService.dispose();
    });

    it('should use cached index when refresh fails', async () => {
      // First load succeeds
      const freshService = new ClientSearchService('/test-url');
      const mockIndex = createTestIndex();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIndex),
      });

      await freshService.loadIndex();

      // Second load fails
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await freshService.loadIndex(true); // force refresh

      // Should still have the original index
      expect(freshService.isIndexLoaded()).toBe(true);
      expect(freshService.getIndexInfo()?.totalPages).toBe(5);

      freshService.dispose();
    });

    it('should not refetch if index is fresh', async () => {
      const freshService = new ClientSearchService('/test-url');
      const mockIndex = createTestIndex();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIndex),
      });

      await freshService.loadIndex();
      await freshService.loadIndex(); // Second call should be skipped

      expect(global.fetch).toHaveBeenCalledTimes(1);

      freshService.dispose();
    });
  });

  describe('dispose()', () => {
    it('should clean up resources', () => {
      service.dispose();

      expect(service.isIndexLoaded()).toBe(false);
      expect(service.getIndexInfo()).toBeNull();
    });
  });

  describe('auto-refresh', () => {
    it('should start and stop auto-refresh without errors', () => {
      // This tests that the methods don't throw
      service.startAutoRefresh();
      service.stopAutoRefresh();
    });

    it('should handle multiple start/stop cycles', () => {
      service.startAutoRefresh();
      service.startAutoRefresh(); // Should stop previous before starting new
      service.stopAutoRefresh();
    });
  });
});
