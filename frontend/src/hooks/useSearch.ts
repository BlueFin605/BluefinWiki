/**
 * useSearch Hook
 *
 * React hook for integrating the backend semantic-search endpoint with the
 * search dialog. Provides debounced query input, pagination, and basic
 * client-side rate limiting.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ClientSearchService } from '../services/ClientSearchService';
import { SearchRateLimiter } from '../utils/searchRateLimiter';
import type { WikiSearchQuery, WikiSearchResult } from '../types/search';

const DEBOUNCE_MS = 300;
const DEFAULT_PAGE_SIZE = 10;
const MAX_SEARCHES_PER_MINUTE = 60;

interface UseSearchOptions {
  /** Path of the search endpoint (overridable for tests). */
  path?: string;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Initial page size (default: 10) */
  pageSize?: number;
}

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: WikiSearchResult[];
  totalResults: number;
  isSearching: boolean;
  executionTimeMs: number;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  scope: string;
  setScope: (scope: string) => void;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    path,
    debounceMs = DEBOUNCE_MS,
    pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  } = options;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [scope, setScope] = useState<string>('all');

  const rateLimiterRef = useRef(new SearchRateLimiter(MAX_SEARCHES_PER_MINUTE));

  const service = useMemo(() => new ClientSearchService(path), [path]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  useEffect(() => {
    setResults([]);
  }, [debouncedQuery, scope, pageSize]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setTotalResults(0);
      setExecutionTimeMs(0);
      setError(null);
      return;
    }

    let cancelled = false;

    const doSearch = async () => {
      if (!rateLimiterRef.current.tryAcquire()) {
        setError('Too many searches. Please wait a moment.');
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const searchQuery: WikiSearchQuery = {
          text: debouncedQuery,
          scope,
          limit: pageSize,
          offset: 0,
        };

        const resultSet = await service.search(searchQuery);

        if (!cancelled) {
          setResults(resultSet.results);
          setTotalResults(resultSet.totalResults);
          setExecutionTimeMs(resultSet.executionTimeMs);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResults([]);
          setTotalResults(0);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    };

    doSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, scope, pageSize, service]);

  const hasMore = results.length < totalResults;

  const loadMore = useCallback(async () => {
    if (!debouncedQuery.trim() || !hasMore || isSearching) return;

    if (!rateLimiterRef.current.tryAcquire()) {
      setError('Too many searches. Please wait a moment.');
      return;
    }

    const newOffset = results.length;
    setIsSearching(true);

    try {
      const searchQuery: WikiSearchQuery = {
        text: debouncedQuery,
        scope,
        limit: pageSize,
        offset: newOffset,
      };

      const resultSet = await service.search(searchQuery);
      setResults(prev => [...prev, ...resultSet.results]);
      setTotalResults(resultSet.totalResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more results');
    } finally {
      setIsSearching(false);
    }
  }, [debouncedQuery, hasMore, isSearching, results.length, scope, pageSize, service]);

  return {
    query,
    setQuery,
    results,
    totalResults,
    isSearching,
    executionTimeMs,
    error,
    hasMore,
    loadMore,
    pageSize,
    setPageSize,
    scope,
    setScope,
  };
}
