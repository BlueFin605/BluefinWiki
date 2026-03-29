/**
 * Search types for BlueFinWiki frontend
 *
 * Types for the client-side search provider (Fuse.js) and search UI.
 */

/**
 * Entry in the client-side search index (downloaded from S3)
 */
export interface ClientSearchIndexEntry {
  /** Page GUID */
  id: string;
  /** Short code for URL-friendly links */
  shortCode?: string;
  /** Page title */
  title: string;
  /** Plain text content (markdown stripped) */
  content: string;
  /** Tags on the page */
  tags: string[];
  /** Hierarchical path */
  path: string;
  /** Last modified date (ISO 8601) */
  modifiedDate: string;
  /** Author user ID */
  author: string;
}

/**
 * The full client-side search index structure
 */
export interface ClientSearchIndex {
  /** Schema version for cache invalidation */
  version: number;
  /** When the index was last built (ISO 8601) */
  builtAt: string;
  /** Total number of indexed pages */
  totalPages: number;
  /** The indexed page entries */
  entries: ClientSearchIndexEntry[];
}

/**
 * Search query for the search dialog
 */
export interface WikiSearchQuery {
  /** The search text */
  text: string;
  /** Search scope: 'all' or a folder path */
  scope: 'all' | string;
  /** If true, only match page titles */
  titleOnly: boolean;
  /** Maximum results to return */
  limit: number;
  /** Offset for pagination */
  offset: number;
}

/**
 * A single search result displayed in the UI
 */
export interface WikiSearchResult {
  /** Page GUID */
  pageId: string;
  /** Page title */
  title: string;
  /** Snippet with matching context */
  snippet: string;
  /** Relevance score */
  relevanceScore: number;
  /** Number of matches */
  matchCount: number;
  /** Hierarchical path */
  path: string;
  /** Tags */
  tags: string[];
}

/**
 * Search result set returned by search operations
 */
export interface WikiSearchResultSet {
  /** Array of search results */
  results: WikiSearchResult[];
  /** Total matching results */
  totalResults: number;
  /** Search execution time in ms */
  executionTimeMs: number;
}

/**
 * Current schema version for the client search index
 */
export const CLIENT_SEARCH_INDEX_VERSION = 1;
