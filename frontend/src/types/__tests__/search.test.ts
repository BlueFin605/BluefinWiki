/**
 * Unit Tests for Frontend Search Types
 */

import { describe, it, expect } from 'vitest';
import type {
  WikiSearchQuery,
  WikiSearchResult,
  WikiSearchResultSet,
} from '../search';

describe('Frontend search types', () => {
  describe('WikiSearchQuery', () => {
    it('should allow a basic query', () => {
      const query: WikiSearchQuery = {
        text: 'family recipes',
        scope: 'all',
        limit: 10,
        offset: 0,
      };

      expect(query.text).toBe('family recipes');
      expect(query.scope).toBe('all');
    });

    it('should allow folder-scoped query', () => {
      const query: WikiSearchQuery = {
        text: 'pasta',
        scope: '/Recipes/Italian',
        limit: 25,
        offset: 10,
      };

      expect(query.scope).toBe('/Recipes/Italian');
    });
  });

  describe('WikiSearchResult', () => {
    it('should allow creating a result', () => {
      const result: WikiSearchResult = {
        pageId: 'page-1',
        title: 'Family Recipes',
        snippet: 'the best family recipes for...',
        relevanceScore: 950,
        matchCount: 0,
        path: 'Cooking > Family Recipes',
        tags: ['recipe', 'family'],
      };

      expect(result.pageId).toBe('page-1');
      expect(result.relevanceScore).toBe(950);
    });
  });

  describe('WikiSearchResultSet', () => {
    it('should allow empty result set', () => {
      const resultSet: WikiSearchResultSet = {
        results: [],
        totalResults: 0,
        executionTimeMs: 3,
      };

      expect(resultSet.results).toHaveLength(0);
      expect(resultSet.executionTimeMs).toBe(3);
    });

    it('should allow paginated result set', () => {
      const resultSet: WikiSearchResultSet = {
        results: [
          {
            pageId: 'page-1',
            title: 'Test',
            snippet: 'snippet',
            relevanceScore: 100,
            matchCount: 0,
            path: 'Test',
            tags: [],
          },
        ],
        totalResults: 50,
        executionTimeMs: 15,
      };

      expect(resultSet.results).toHaveLength(1);
      expect(resultSet.totalResults).toBe(50);
    });
  });
});
