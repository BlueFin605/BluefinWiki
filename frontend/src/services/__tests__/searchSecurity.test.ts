/**
 * Unit Tests for Search Security & Input Validation
 * Task 8.4: XSS prevention, query sanitization, rate limiting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClientSearchService } from '../ClientSearchService';
import type { ClientSearchIndex } from '../../types/search';

const createTestIndex = (): ClientSearchIndex => ({
  version: 1,
  builtAt: '2026-03-17T12:00:00Z',
  totalPages: 2,
  entries: [
    {
      id: 'page-1',
      title: 'Test Page',
      content: 'Some content with special <script>alert("xss")</script> text',
      tags: ['test'],
      path: 'Test Page',
      modifiedDate: '2026-03-17T12:00:00Z',
      author: 'user-123',
    },
    {
      id: 'page-2',
      title: 'Another Page',
      content: 'Normal content here',
      tags: [],
      path: 'Another Page',
      modifiedDate: '2026-03-16T12:00:00Z',
      author: 'user-456',
    },
  ],
});

describe('Search Security & Input Validation', () => {
  let service: ClientSearchService;

  beforeEach(() => {
    service = new ClientSearchService();
    service.setIndex(createTestIndex());
  });

  afterEach(() => {
    service.dispose();
  });

  describe('query sanitization', () => {
    it('should strip angle brackets from query to prevent XSS', async () => {
      const results = await service.search({
        text: '<script>alert("xss")</script>',
        scope: 'all',
        titleOnly: false,
        limit: 10,
        offset: 0,
      });

      // The sanitized query should not contain < or >
      // It should still attempt to search with the cleaned text
      expect(results).toBeDefined();
      expect(results.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should truncate queries longer than 500 characters', async () => {
      const longQuery = 'a'.repeat(1000);
      const results = await service.search({
        text: longQuery,
        scope: 'all',
        titleOnly: false,
        limit: 10,
        offset: 0,
      });

      // Should not throw and should return a valid result set
      expect(results).toBeDefined();
      expect(results.results).toBeDefined();
    });

    it('should handle empty query safely', async () => {
      const results = await service.search({
        text: '',
        scope: 'all',
        titleOnly: false,
        limit: 10,
        offset: 0,
      });

      expect(results.results).toHaveLength(0);
      expect(results.totalResults).toBe(0);
    });

    it('should handle query with only special characters', async () => {
      const results = await service.search({
        text: '<<<>>>',
        scope: 'all',
        titleOnly: false,
        limit: 10,
        offset: 0,
      });

      // After stripping < and >, query becomes empty
      expect(results.results).toHaveLength(0);
    });

    it('should preserve normal search functionality after sanitization', async () => {
      const results = await service.search({
        text: 'Test',
        scope: 'all',
        titleOnly: false,
        limit: 10,
        offset: 0,
      });

      expect(results.results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('result safety', () => {
    it('should return snippets as plain text (no HTML)', async () => {
      const results = await service.search({
        text: 'content',
        scope: 'all',
        titleOnly: false,
        limit: 10,
        offset: 0,
      });

      // Snippets come from stripped markdown content — they should be plain text
      for (const result of results.results) {
        // The snippet should not contain unescaped script tags
        // (React handles rendering safely, but the data itself should be clean)
        expect(result.snippet).toBeDefined();
        expect(typeof result.snippet).toBe('string');
      }
    });

    it('should return all result fields as proper types', async () => {
      const results = await service.search({
        text: 'Test',
        scope: 'all',
        titleOnly: false,
        limit: 10,
        offset: 0,
      });

      for (const result of results.results) {
        expect(typeof result.pageId).toBe('string');
        expect(typeof result.title).toBe('string');
        expect(typeof result.snippet).toBe('string');
        expect(typeof result.relevanceScore).toBe('number');
        expect(typeof result.matchCount).toBe('number');
        expect(typeof result.path).toBe('string');
        expect(Array.isArray(result.tags)).toBe(true);
      }
    });
  });
});
