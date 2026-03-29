/**
 * Unit Tests for Search Provider Registry and Factory
 * Task 8.1: Search provider plugin loader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SearchProviderRegistry,
  SearchProviderFactory,
  getSearchProvider,
  initializeSearchProvider,
  resetSearchProvider,
  isSearchProviderInitialized,
} from '../SearchProviderRegistry.js';
import type { ISearchProvider } from '../SearchProvider.js';
import type {
  SearchQuery,
  SearchResultSet,
  SearchCapabilities,
} from '../SearchTypes.js';

/**
 * Minimal mock provider for registry tests
 */
class FakeClientSideProvider implements ISearchProvider {
  constructor(public config: Record<string, unknown> = {}) {}

  async indexPage(): Promise<void> {}
  async search(query: SearchQuery): Promise<SearchResultSet> {
    return { results: [], totalResults: 0, executionTimeMs: 0 };
  }
  async deletePage(): Promise<void> {}
  async reindexAll(): Promise<void> {}
  getCapabilities(): SearchCapabilities {
    return { fuzzySearch: true, faceting: false, highlighting: true, estimatedMonthlyCost: 0 };
  }
  getType(): string {
    return 'client-side';
  }
}

class FakeDynamoDBProvider implements ISearchProvider {
  constructor(public config: Record<string, unknown> = {}) {}

  async indexPage(): Promise<void> {}
  async search(): Promise<SearchResultSet> {
    return { results: [], totalResults: 0, executionTimeMs: 0 };
  }
  async deletePage(): Promise<void> {}
  async reindexAll(): Promise<void> {}
  getCapabilities(): SearchCapabilities {
    return { fuzzySearch: false, faceting: true, highlighting: false, estimatedMonthlyCost: 5 };
  }
  getType(): string {
    return 'dynamodb';
  }
}

class FailingProvider implements ISearchProvider {
  constructor() {
    throw new Error('Initialization failed: missing API key');
  }
  async indexPage(): Promise<void> {}
  async search(): Promise<SearchResultSet> {
    return { results: [], totalResults: 0, executionTimeMs: 0 };
  }
  async deletePage(): Promise<void> {}
  async reindexAll(): Promise<void> {}
  getCapabilities(): SearchCapabilities {
    return { fuzzySearch: false, faceting: false, highlighting: false, estimatedMonthlyCost: 0 };
  }
  getType(): string {
    return 'failing';
  }
}

describe('SearchProviderRegistry', () => {
  beforeEach(() => {
    SearchProviderRegistry.clear();
  });

  describe('register()', () => {
    it('should register a provider type', () => {
      SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
      expect(SearchProviderRegistry.has('client-side')).toBe(true);
    });

    it('should throw when registering duplicate type', () => {
      SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
      expect(() =>
        SearchProviderRegistry.register('client-side', FakeClientSideProvider as never)
      ).toThrow("Search provider type 'client-side' is already registered");
    });

    it('should allow registering multiple different types', () => {
      SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
      SearchProviderRegistry.register('dynamodb', FakeDynamoDBProvider as never);

      expect(SearchProviderRegistry.has('client-side')).toBe(true);
      expect(SearchProviderRegistry.has('dynamodb')).toBe(true);
    });
  });

  describe('get()', () => {
    it('should return registered provider class', () => {
      SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
      const ProviderClass = SearchProviderRegistry.get('client-side');
      expect(ProviderClass).toBe(FakeClientSideProvider);
    });

    it('should throw for unregistered type', () => {
      expect(() => SearchProviderRegistry.get('nonexistent')).toThrow(
        "Search provider type 'nonexistent' is not registered"
      );
    });

    it('should list available types in error message', () => {
      SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
      SearchProviderRegistry.register('dynamodb', FakeDynamoDBProvider as never);

      try {
        SearchProviderRegistry.get('s3-vectors');
      } catch (error) {
        expect((error as Error).message).toContain('client-side');
        expect((error as Error).message).toContain('dynamodb');
      }
    });
  });

  describe('has()', () => {
    it('should return false for unregistered type', () => {
      expect(SearchProviderRegistry.has('nonexistent')).toBe(false);
    });

    it('should return true for registered type', () => {
      SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
      expect(SearchProviderRegistry.has('client-side')).toBe(true);
    });
  });

  describe('list()', () => {
    it('should return empty array when nothing registered', () => {
      expect(SearchProviderRegistry.list()).toEqual([]);
    });

    it('should return all registered types', () => {
      SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
      SearchProviderRegistry.register('dynamodb', FakeDynamoDBProvider as never);

      const types = SearchProviderRegistry.list();
      expect(types).toContain('client-side');
      expect(types).toContain('dynamodb');
      expect(types).toHaveLength(2);
    });
  });

  describe('clear()', () => {
    it('should remove all registered providers', () => {
      SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
      SearchProviderRegistry.register('dynamodb', FakeDynamoDBProvider as never);

      SearchProviderRegistry.clear();

      expect(SearchProviderRegistry.list()).toEqual([]);
      expect(SearchProviderRegistry.has('client-side')).toBe(false);
    });
  });
});

describe('SearchProviderFactory', () => {
  beforeEach(() => {
    SearchProviderRegistry.clear();
    SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
    SearchProviderRegistry.register('dynamodb', FakeDynamoDBProvider as never);
  });

  describe('create()', () => {
    it('should create a provider instance from config', () => {
      const provider = SearchProviderFactory.create({ type: 'client-side' });

      expect(provider).toBeInstanceOf(FakeClientSideProvider);
      expect(provider.getType()).toBe('client-side');
    });

    it('should pass config to provider constructor', () => {
      const provider = SearchProviderFactory.create({
        type: 'dynamodb',
        tableName: 'WikiSearchIndex',
        region: 'us-east-1',
      });

      expect(provider).toBeInstanceOf(FakeDynamoDBProvider);
      expect((provider as FakeDynamoDBProvider).config).toEqual({
        type: 'dynamodb',
        tableName: 'WikiSearchIndex',
        region: 'us-east-1',
      });
    });

    it('should throw when type is missing', () => {
      expect(() =>
        SearchProviderFactory.create({ type: '' })
      ).toThrow('Search provider type is required');
    });

    it('should throw when provider type is not registered', () => {
      expect(() =>
        SearchProviderFactory.create({ type: 's3-vectors' })
      ).toThrow("Search provider type 's3-vectors' is not registered");
    });

    it('should wrap provider initialization errors', () => {
      SearchProviderRegistry.register('failing', FailingProvider as never);

      expect(() =>
        SearchProviderFactory.create({ type: 'failing' })
      ).toThrow("Failed to initialize search provider 'failing': Initialization failed: missing API key");
    });
  });

  describe('fromEnvironment()', () => {
    const originalEnv = process.env.SEARCH_PROVIDER_TYPE;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.SEARCH_PROVIDER_TYPE;
      } else {
        process.env.SEARCH_PROVIDER_TYPE = originalEnv;
      }
    });

    it('should default to client-side when env var not set', () => {
      delete process.env.SEARCH_PROVIDER_TYPE;

      const provider = SearchProviderFactory.fromEnvironment();
      expect(provider.getType()).toBe('client-side');
    });

    it('should use SEARCH_PROVIDER_TYPE env var', () => {
      process.env.SEARCH_PROVIDER_TYPE = 'dynamodb';

      const provider = SearchProviderFactory.fromEnvironment();
      expect(provider).toBeInstanceOf(FakeDynamoDBProvider);
    });
  });
});

describe('Global search provider singleton', () => {
  beforeEach(() => {
    resetSearchProvider();
    SearchProviderRegistry.clear();
    SearchProviderRegistry.register('client-side', FakeClientSideProvider as never);
  });

  afterEach(() => {
    resetSearchProvider();
    // Restore env
    delete process.env.SEARCH_PROVIDER_TYPE;
  });

  describe('getSearchProvider()', () => {
    it('should auto-initialize from environment', () => {
      delete process.env.SEARCH_PROVIDER_TYPE;
      const provider = getSearchProvider();
      expect(provider).toBeInstanceOf(FakeClientSideProvider);
    });

    it('should return the same instance on subsequent calls', () => {
      const provider1 = getSearchProvider();
      const provider2 = getSearchProvider();
      expect(provider1).toBe(provider2);
    });
  });

  describe('initializeSearchProvider()', () => {
    it('should initialize with explicit config', () => {
      const provider = initializeSearchProvider({ type: 'client-side' });
      expect(provider).toBeInstanceOf(FakeClientSideProvider);
      expect(isSearchProviderInitialized()).toBe(true);
    });

    it('should throw when already initialized', () => {
      initializeSearchProvider({ type: 'client-side' });
      expect(() =>
        initializeSearchProvider({ type: 'client-side' })
      ).toThrow('Search provider already initialized');
    });

    it('should initialize from environment when no config provided', () => {
      delete process.env.SEARCH_PROVIDER_TYPE;
      const provider = initializeSearchProvider();
      expect(provider.getType()).toBe('client-side');
    });
  });

  describe('resetSearchProvider()', () => {
    it('should allow re-initialization after reset', () => {
      initializeSearchProvider({ type: 'client-side' });
      resetSearchProvider();

      expect(isSearchProviderInitialized()).toBe(false);

      const provider = initializeSearchProvider({ type: 'client-side' });
      expect(provider).toBeInstanceOf(FakeClientSideProvider);
    });
  });

  describe('isSearchProviderInitialized()', () => {
    it('should return false before initialization', () => {
      expect(isSearchProviderInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      initializeSearchProvider({ type: 'client-side' });
      expect(isSearchProviderInitialized()).toBe(true);
    });

    it('should return false after reset', () => {
      initializeSearchProvider({ type: 'client-side' });
      resetSearchProvider();
      expect(isSearchProviderInitialized()).toBe(false);
    });
  });
});
