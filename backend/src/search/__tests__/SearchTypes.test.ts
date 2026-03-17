/**
 * Unit Tests for Search Types
 * Task 8.1: Search type definitions and validation
 */

import { describe, it, expect } from 'vitest';
import {
  CLIENT_SEARCH_INDEX_VERSION,
} from '../SearchTypes.js';
import type {
  SearchQuery,
  SearchResult,
  SearchResultSet,
  SearchCapabilities,
  SearchProviderConfig,
  ClientSearchIndex,
  ClientSearchIndexEntry,
} from '../SearchTypes.js';

describe('SearchQuery type', () => {
  it('should allow creating a minimal search query', () => {
    const query: SearchQuery = {
      text: 'test query',
      limit: 10,
      offset: 0,
    };

    expect(query.text).toBe('test query');
    expect(query.limit).toBe(10);
    expect(query.offset).toBe(0);
    expect(query.scope).toBeUndefined();
    expect(query.titleOnly).toBeUndefined();
    expect(query.tags).toBeUndefined();
  });

  it('should allow creating a fully specified search query', () => {
    const query: SearchQuery = {
      text: 'family recipes',
      scope: '/Recipes/Italian',
      titleOnly: true,
      tags: ['recipe', 'italian'],
      limit: 25,
      offset: 10,
    };

    expect(query.text).toBe('family recipes');
    expect(query.scope).toBe('/Recipes/Italian');
    expect(query.titleOnly).toBe(true);
    expect(query.tags).toEqual(['recipe', 'italian']);
    expect(query.limit).toBe(25);
    expect(query.offset).toBe(10);
  });

  it('should allow scope "all" for searching all pages', () => {
    const query: SearchQuery = {
      text: 'search everything',
      scope: 'all',
      limit: 10,
      offset: 0,
    };

    expect(query.scope).toBe('all');
  });
});

describe('SearchResult type', () => {
  it('should allow creating a search result with required fields', () => {
    const result: SearchResult = {
      pageId: 'abc-123',
      title: 'Test Page',
      snippet: '...matching **test** content...',
      relevanceScore: 850,
      matchCount: 3,
      path: 'Parent > Test Page',
      tags: ['test'],
    };

    expect(result.pageId).toBe('abc-123');
    expect(result.title).toBe('Test Page');
    expect(result.snippet).toContain('test');
    expect(result.relevanceScore).toBe(850);
    expect(result.matchCount).toBe(3);
    expect(result.path).toBe('Parent > Test Page');
    expect(result.tags).toEqual(['test']);
  });

  it('should allow optional shortCode', () => {
    const result: SearchResult = {
      pageId: 'abc-123',
      shortCode: 'TST',
      title: 'Test Page',
      snippet: 'snippet',
      relevanceScore: 100,
      matchCount: 1,
      path: 'Test Page',
      tags: [],
    };

    expect(result.shortCode).toBe('TST');
  });
});

describe('SearchResultSet type', () => {
  it('should allow creating an empty result set', () => {
    const resultSet: SearchResultSet = {
      results: [],
      totalResults: 0,
      executionTimeMs: 5,
    };

    expect(resultSet.results).toHaveLength(0);
    expect(resultSet.totalResults).toBe(0);
    expect(resultSet.executionTimeMs).toBe(5);
  });

  it('should allow totalResults greater than results array length (pagination)', () => {
    const results: SearchResult[] = Array.from({ length: 10 }, (_, i) => ({
      pageId: `page-${i}`,
      title: `Page ${i}`,
      snippet: `Snippet ${i}`,
      relevanceScore: 100 - i,
      matchCount: 1,
      path: `Page ${i}`,
      tags: [],
    }));

    const resultSet: SearchResultSet = {
      results,
      totalResults: 150,
      executionTimeMs: 42,
    };

    expect(resultSet.results).toHaveLength(10);
    expect(resultSet.totalResults).toBe(150);
  });
});

describe('SearchCapabilities type', () => {
  it('should describe client-side provider capabilities', () => {
    const capabilities: SearchCapabilities = {
      fuzzySearch: true,
      faceting: false,
      highlighting: true,
      estimatedMonthlyCost: 0,
    };

    expect(capabilities.fuzzySearch).toBe(true);
    expect(capabilities.faceting).toBe(false);
    expect(capabilities.highlighting).toBe(true);
    expect(capabilities.estimatedMonthlyCost).toBe(0);
  });

  it('should describe a paid provider capabilities', () => {
    const capabilities: SearchCapabilities = {
      fuzzySearch: true,
      faceting: true,
      highlighting: true,
      estimatedMonthlyCost: 0.15,
    };

    expect(capabilities.estimatedMonthlyCost).toBeGreaterThan(0);
  });
});

describe('SearchProviderConfig type', () => {
  it('should allow minimal config with just type', () => {
    const config: SearchProviderConfig = {
      type: 'client-side',
    };

    expect(config.type).toBe('client-side');
  });

  it('should allow additional provider-specific config', () => {
    const config: SearchProviderConfig = {
      type: 'dynamodb',
      tableName: 'WikiSearchIndex',
      region: 'us-east-1',
    };

    expect(config.type).toBe('dynamodb');
    expect(config.tableName).toBe('WikiSearchIndex');
  });
});

describe('ClientSearchIndex type', () => {
  it('should allow creating an empty index', () => {
    const index: ClientSearchIndex = {
      version: CLIENT_SEARCH_INDEX_VERSION,
      builtAt: '2026-03-17T12:00:00Z',
      totalPages: 0,
      entries: [],
    };

    expect(index.version).toBe(1);
    expect(index.entries).toHaveLength(0);
    expect(index.totalPages).toBe(0);
  });

  it('should allow creating an index with entries', () => {
    const entry: ClientSearchIndexEntry = {
      id: 'page-guid-1',
      shortCode: 'GP',
      title: 'Getting Started',
      content: 'Welcome to the wiki. This is the getting started guide.',
      tags: ['guide', 'onboarding'],
      path: 'Getting Started',
      modifiedDate: '2026-03-17T12:00:00Z',
      author: 'user-123',
    };

    const index: ClientSearchIndex = {
      version: CLIENT_SEARCH_INDEX_VERSION,
      builtAt: '2026-03-17T12:00:00Z',
      totalPages: 1,
      entries: [entry],
    };

    expect(index.entries).toHaveLength(1);
    expect(index.entries[0].title).toBe('Getting Started');
    expect(index.entries[0].content).not.toContain('#');
    expect(index.entries[0].tags).toEqual(['guide', 'onboarding']);
  });

  it('should have correct version constant', () => {
    expect(CLIENT_SEARCH_INDEX_VERSION).toBe(1);
  });
});

describe('ClientSearchIndexEntry type', () => {
  it('should allow entry without optional shortCode', () => {
    const entry: ClientSearchIndexEntry = {
      id: 'page-guid-1',
      title: 'My Page',
      content: 'Some plain text content',
      tags: [],
      path: 'My Page',
      modifiedDate: '2026-03-17T12:00:00Z',
      author: 'user-456',
    };

    expect(entry.shortCode).toBeUndefined();
    expect(entry.id).toBe('page-guid-1');
  });
});
