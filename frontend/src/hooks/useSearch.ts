/**
 * useSearch Hook
 *
 * React hook for integrating ClientSearchService with components.
 * Provides debounced search, state management, and pagination.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ClientSearchService } from '../services/ClientSearchService';
import { SearchRateLimiter } from '../utils/searchRateLimiter';
import type { WikiSearchQuery, WikiSearchResult } from '../types/search';

const DEBOUNCE_MS = 300;
const DEFAULT_PAGE_SIZE = 10;
const MAX_SEARCHES_PER_MINUTE = 60;

interface UseSearchOptions {
  /** URL to fetch the search index from */
  indexUrl?: string;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Initial page size (default: 10) */
  pageSize?: number;
}

interface UseSearchReturn {
  /** Current search query text */
  query: string;
  /** Set the search query text */
  setQuery: (query: string) => void;
  /** Search results */
  results: WikiSearchResult[];
  /** Total number of results (across all pages) */
  totalResults: number;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Search execution time in ms */
  executionTimeMs: number;
  /** Error message if search failed */
  error: string | null;
  /** Whether there are more results to load */
  hasMore: boolean;
  /** Load more results */
  loadMore: () => void;
  /** Current page size */
  pageSize: number;
  /** Set page size (10, 25, 50) */
  setPageSize: (size: number) => void;
  /** Search scope */
  scope: string;
  /** Set search scope */
  setScope: (scope: string) => void;
  /** Title-only mode */
  titleOnly: boolean;
  /** Set title-only mode */
  setTitleOnly: (titleOnly: boolean) => void;
  /** Whether the search index is loaded */
  isIndexLoaded: boolean;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    indexUrl,
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
  const [titleOnly, setTitleOnly] = useState(false);
  const [isIndexLoaded, setIsIndexLoaded] = useState(false);

  const serviceRef = useRef<ClientSearchService | null>(null);
  const rateLimiterRef = useRef(new SearchRateLimiter(MAX_SEARCHES_PER_MINUTE));

  // Initialize the search service
  const service = useMemo(() => {
    const svc = new ClientSearchService(indexUrl);
    serviceRef.current = svc;
    return svc;
  }, [indexUrl]);

  // Load index on mount
  useEffect(() => {
    service.loadIndex()
      .then(() => setIsIndexLoaded(true))
      .catch(() => {
        // Will be handled on search
      });

    service.startAutoRefresh();

    return () => {
      service.dispose();
    };
  }, [service]);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Reset pagination when query, scope, or titleOnly changes
  useEffect(() => {
    setResults([]);
  }, [debouncedQuery, scope, titleOnly, pageSize]);

  // Execute search when debounced query changes
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
          titleOnly,
          limit: pageSize,
          offset: 0,
        };

        const resultSet = await service.search(searchQuery);

        if (!cancelled) {
          setResults(resultSet.results);
          setTotalResults(resultSet.totalResults);
          setExecutionTimeMs(resultSet.executionTimeMs);
          setIsIndexLoaded(service.isIndexLoaded());
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
  }, [debouncedQuery, scope, titleOnly, pageSize, service]);

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
        titleOnly,
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
  }, [debouncedQuery, hasMore, isSearching, results.length, scope, titleOnly, pageSize, service]);

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
    titleOnly,
    setTitleOnly,
    isIndexLoaded,
  };
}
