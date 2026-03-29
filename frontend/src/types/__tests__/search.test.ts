/**
 * Unit Tests for Frontend Search Types
 * Task 8.1: Verify search type definitions
 */

import { describe, it, expect } from 'vitest';
import { CLIENT_SEARCH_INDEX_VERSION } from '../search';
import type {
  ClientSearchIndex,
  ClientSearchIndexEntry,
  WikiSearchQuery,
  WikiSearchResult,
  WikiSearchResultSet,
} from '../search';

describe('Frontend search types', () => {
  describe('ClientSearchIndex', () => {
    it('should have correct version constant', () => {
      expect(CLIENT_SEARCH_INDEX_VERSION).toBe(1);
    });

    it('should allow creating a valid index', () => {
      const index: ClientSearchIndex = {
        version: CLIENT_SEARCH_INDEX_VERSION,
        builtAt: '2026-03-17T12:00:00Z',
        totalPages: 2,
        entries: [
          {
            id: 'page-1',
            title: 'Getting Started',
            content: 'Welcome to the wiki',
            tags: ['guide'],
            path: 'Getting Started',
            modifiedDate: '2026-03-17T12:00:00Z',
            author: 'user-123',
          },
          {
            id: 'page-2',
            shortCode: 'FAQ',
            title: 'FAQ',
            content: 'Frequently asked questions',
            tags: ['help', 'faq'],
            path: 'Help > FAQ',
            modifiedDate: '2026-03-16T12:00:00Z',
            author: 'user-456',
          },
        ],
      };

      expect(index.version).toBe(1);
      expect(index.totalPages).toBe(2);
      expect(index.entries).toHaveLength(2);
      expect(index.entries[0].shortCode).toBeUndefined();
      expect(index.entries[1].shortCode).toBe('FAQ');
    });

    it('should allow empty index', () => {
      const index: ClientSearchIndex = {
        version: CLIENT_SEARCH_INDEX_VERSION,
        builtAt: '2026-03-17T12:00:00Z',
        totalPages: 0,
        entries: [],
      };

      expect(index.entries).toHaveLength(0);
    });
  });

  describe('ClientSearchIndexEntry', () => {
    it('should allow entry with all fields', () => {
      const entry: ClientSearchIndexEntry = {
        id: 'abc-123',
        shortCode: 'GS',
        title: 'Getting Started',
        content: 'This is the stripped content without markdown',
        tags: ['guide', 'onboarding'],
        path: 'Docs > Getting Started',
        modifiedDate: '2026-03-17T12:00:00Z',
        author: 'user-123',
      };

      expect(entry.id).toBe('abc-123');
      expect(entry.shortCode).toBe('GS');
      expect(entry.tags).toHaveLength(2);
    });

    it('should allow entry without optional shortCode', () => {
      const entry: ClientSearchIndexEntry = {
        id: 'def-456',
        title: 'Test Page',
        content: 'content',
        tags: [],
        path: 'Test Page',
        modifiedDate: '2026-03-17T12:00:00Z',
        author: 'user-456',
      };

      expect(entry.shortCode).toBeUndefined();
    });
  });

  describe('WikiSearchQuery', () => {
    it('should allow a basic query', () => {
      const query: WikiSearchQuery = {
        text: 'family recipes',
        scope: 'all',
        titleOnly: false,
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
        titleOnly: true,
        limit: 25,
        offset: 10,
      };

      expect(query.scope).toBe('/Recipes/Italian');
      expect(query.titleOnly).toBe(true);
    });
  });

  describe('WikiSearchResult', () => {
    it('should allow creating a result', () => {
      const result: WikiSearchResult = {
        pageId: 'page-1',
        title: 'Family Recipes',
        snippet: '...the best **family** **recipes** for...',
        relevanceScore: 950,
        matchCount: 5,
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
            matchCount: 1,
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
