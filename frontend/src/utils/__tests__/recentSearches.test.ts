/**
 * Unit Tests for Recent Searches Utility
 * Task 8.3: Recent searches in localStorage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// We need to control localStorage for these tests
const store: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Import after setting up the mock
const { getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } = await import('../recentSearches');

describe('recentSearches', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    vi.clearAllMocks();
  });

  describe('getRecentSearches()', () => {
    it('should return empty array when no searches stored', () => {
      expect(getRecentSearches()).toEqual([]);
    });

    it('should return stored searches', () => {
      addRecentSearch('test query');
      const searches = getRecentSearches();
      expect(searches).toHaveLength(1);
      expect(searches[0].query).toBe('test query');
    });

    it('should filter out expired searches (older than 30 days)', () => {
      const oldTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000;
      store['bluefin_recent_searches'] = JSON.stringify([
        { query: 'old', timestamp: oldTimestamp },
        { query: 'new', timestamp: Date.now() },
      ]);

      const searches = getRecentSearches();
      expect(searches).toHaveLength(1);
      expect(searches[0].query).toBe('new');
    });

    it('should handle corrupted localStorage data', () => {
      store['bluefin_recent_searches'] = 'not-json';
      expect(getRecentSearches()).toEqual([]);
    });
  });

  describe('addRecentSearch()', () => {
    it('should add a new search', () => {
      addRecentSearch('hello');
      const searches = getRecentSearches();
      expect(searches).toHaveLength(1);
      expect(searches[0].query).toBe('hello');
    });

    it('should add new search at the front', () => {
      addRecentSearch('first');
      addRecentSearch('second');
      const searches = getRecentSearches();
      expect(searches[0].query).toBe('second');
      expect(searches[1].query).toBe('first');
    });

    it('should deduplicate existing queries (move to front)', () => {
      addRecentSearch('first');
      addRecentSearch('second');
      addRecentSearch('first');
      const searches = getRecentSearches();
      expect(searches).toHaveLength(2);
      expect(searches[0].query).toBe('first');
      expect(searches[1].query).toBe('second');
    });

    it('should limit to 10 entries', () => {
      for (let i = 0; i < 15; i++) {
        addRecentSearch(`query-${i}`);
      }
      const searches = getRecentSearches();
      expect(searches).toHaveLength(10);
      expect(searches[0].query).toBe('query-14');
    });

    it('should ignore empty queries', () => {
      addRecentSearch('');
      addRecentSearch('   ');
      expect(getRecentSearches()).toHaveLength(0);
    });

    it('should trim whitespace', () => {
      addRecentSearch('  hello world  ');
      const searches = getRecentSearches();
      expect(searches[0].query).toBe('hello world');
    });
  });

  describe('removeRecentSearch()', () => {
    it('should remove a specific search', () => {
      addRecentSearch('first');
      addRecentSearch('second');
      addRecentSearch('third');

      removeRecentSearch('second');
      const searches = getRecentSearches();
      expect(searches).toHaveLength(2);
      expect(searches.find(s => s.query === 'second')).toBeUndefined();
    });

    it('should not throw when removing non-existent search', () => {
      addRecentSearch('first');
      removeRecentSearch('nonexistent');
      expect(getRecentSearches()).toHaveLength(1);
    });
  });

  describe('clearRecentSearches()', () => {
    it('should clear all searches', () => {
      addRecentSearch('first');
      addRecentSearch('second');

      clearRecentSearches();
      expect(getRecentSearches()).toEqual([]);
    });

    it('should not throw when already empty', () => {
      clearRecentSearches();
      expect(getRecentSearches()).toEqual([]);
    });
  });
});
