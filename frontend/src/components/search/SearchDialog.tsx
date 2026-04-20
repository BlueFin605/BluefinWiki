/**
 * SearchDialog Component
 *
 * Full-featured search dialog overlay with:
 * - Cmd/Ctrl+K keyboard shortcut to open
 * - Fuzzy search via Fuse.js (client-side)
 * - Keyboard navigation (Up/Down/Enter/Escape/Home/End)
 * - Highlighted matching terms in snippets
 * - Folder path display
 * - Search filters (scope, title-only)
 * - Infinite scroll / load more
 * - Recent searches
 * - WCAG 2.1 AA accessibility
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearch } from '../../hooks/useSearch';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  RecentSearch,
} from '../../utils/recentSearches';
import type { WikiSearchResult } from '../../types/search';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (pageId: string) => void;
}

/**
 * Highlight matching terms in text by wrapping them in <mark>
 */
function highlightTerms(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ isOpen, onClose, onNavigate }) => {
  const {
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
  } = useSearch();

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerRef = useRef<HTMLElement | null>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Load recent searches when dialog opens
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      triggerRef.current = document.activeElement as HTMLElement;
      // Focus input after render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      // Return focus to trigger element
      setQuery('');
      setSelectedIndex(-1);
      triggerRef.current?.focus();
    }
  }, [isOpen, setQuery]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(results.length > 0 ? 0 : -1);
    itemRefs.current = [];
  }, [results]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Announce results to screen readers
  useEffect(() => {
    if (liveRegionRef.current && query.trim()) {
      if (isSearching) {
        liveRegionRef.current.textContent = 'Searching...';
      } else if (results.length > 0) {
        liveRegionRef.current.textContent = `${totalResults} result${totalResults === 1 ? '' : 's'} found for "${query}"`;
      } else {
        liveRegionRef.current.textContent = `No results found for "${query}"`;
      }
    }
  }, [results, totalResults, isSearching, query]);

  const handleSelect = useCallback(
    (result: WikiSearchResult, newTab = false) => {
      addRecentSearch(query);
      if (newTab) {
        window.open(`/pages/${result.pageId}`, '_blank');
      } else {
        onNavigate(result.pageId);
        onClose();
      }
    },
    [query, onNavigate, onClose]
  );

  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
    },
    [setQuery]
  );

  const handleRemoveRecent = useCallback((searchQuery: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(searchQuery);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelect(results[selectedIndex], e.ctrlKey || e.metaKey);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Home':
          e.preventDefault();
          if (results.length > 0) setSelectedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          if (results.length > 0) setSelectedIndex(results.length - 1);
          break;
      }
    },
    [results, selectedIndex, handleSelect, onClose]
  );

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (!resultsRef.current || !hasMore || isSearching) return;

    const { scrollTop, scrollHeight, clientHeight } = resultsRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMore();
    }
  }, [hasMore, isSearching, loadMore]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const showRecentSearches = !query.trim() && recentSearches.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-0 md:pt-[15vh] z-50"
      onClick={handleBackdropClick}
      role="presentation"
    >
      {/* Screen reader live region */}
      <div
        ref={liveRegionRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />

      <div
        className="bg-white dark:bg-gray-800 shadow-2xl w-full h-full md:h-auto md:rounded-xl md:max-w-2xl md:max-h-[70vh] flex flex-col"
        role="dialog"
        aria-label="Search wiki"
        aria-modal="true"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <svg
            className="w-5 h-5 text-gray-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search wiki..."
            className="flex-1 px-3 py-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-hidden text-lg"
            aria-label="Search wiki"
            aria-controls="search-results"
            aria-activedescendant={
              selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined
            }
            role="combobox"
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
            maxLength={500}
          />
          {isSearching && (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" aria-hidden="true" />
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`ml-2 p-1.5 rounded-md transition-colors ${
              showFilters || titleOnly || scope !== 'all'
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-label="Toggle search filters"
            aria-expanded={showFilters}
            title="Filters"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
          <kbd className="ml-2 hidden sm:inline-block px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-sm">
            Esc
          </kbd>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2" htmlFor="search-scope">
              <span className="text-gray-600 dark:text-gray-400">Scope:</span>
              <select
                id="search-scope"
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-sm px-2 py-1 text-sm outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All pages</option>
              </select>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={titleOnly}
                onChange={e => setTitleOnly(e.target.checked)}
                className="rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-600 dark:text-gray-400">Title only</span>
            </label>
            <label className="flex items-center gap-2 ml-auto" htmlFor="search-page-size">
              <span className="text-gray-600 dark:text-gray-400">Per page:</span>
              <select
                id="search-page-size"
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-sm px-2 py-1 text-sm outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
        )}

        {/* Results area */}
        <div
          ref={resultsRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
          id="search-results"
          role="listbox"
          aria-label="Search results"
        >
          {/* Recent searches */}
          {showRecentSearches && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Recent searches
                </span>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Clear all
                </button>
              </div>
              {recentSearches.map(recent => (
                <button
                  key={recent.query}
                  className="flex items-center justify-between w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md group"
                  onClick={() => handleRecentSearchClick(recent.query)}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {recent.query}
                  </div>
                  <button
                    onClick={e => handleRemoveRecent(recent.query, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-sm"
                    aria-label={`Remove "${recent.query}" from recent searches`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="px-4 py-8 text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* No results */}
          {!error && !isSearching && query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No results found for &ldquo;{query}&rdquo;
              </p>
              {titleOnly && (
                <p className="text-sm text-gray-400 mt-1">
                  Try disabling &ldquo;Title only&rdquo; to search content too
                </p>
              )}
            </div>
          )}

          {/* Search results */}
          {results.map((result, index) => (
            <button
              key={result.pageId}
              id={`search-result-${index}`}
              ref={el => { itemRefs.current[index] = el; }}
              role="option"
              aria-selected={index === selectedIndex}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-hidden ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : ''
              }`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                  {highlightTerms(result.title, query)}
                </h4>
                {result.tags.length > 0 && (
                  <div className="flex gap-1 shrink-0">
                    {result.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {result.snippet && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {highlightTerms(result.snippet, query)}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {result.path}
              </p>
            </button>
          ))}

          {/* Load more */}
          {hasMore && !isSearching && (
            <button
              onClick={loadMore}
              className="w-full px-4 py-3 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-center"
            >
              Load more results ({results.length} of {totalResults})
            </button>
          )}

          {/* Loading more */}
          {isSearching && results.length > 0 && (
            <div className="px-4 py-3 text-center text-sm text-gray-500">
              Loading more results...
            </div>
          )}
        </div>

        {/* Footer */}
        {query.trim() && results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
            <span>
              {totalResults} result{totalResults === 1 ? '' : 's'} ({executionTimeMs}ms)
            </span>
            <div className="flex gap-3">
              <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-sm">&#8593;&#8595;</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-sm">&#9166;</kbd> open</span>
              <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-sm">Ctrl+&#9166;</kbd> new tab</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchDialog;
