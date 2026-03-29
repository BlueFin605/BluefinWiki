/**
 * Search Types
 *
 * Core type definitions for the pluggable search architecture.
 * These types define the contract between search providers and consumers.
 */

/**
 * Search query parameters
 */
export interface SearchQuery {
  /** The search text */
  text: string;
  /** Search scope: all pages or within a specific folder path */
  scope?: 'all' | string;
  /** If true, only match against page titles */
  titleOnly?: boolean;
  /** Filter by tags */
  tags?: string[];
  /** Maximum number of results to return */
  limit: number;
  /** Offset for pagination */
  offset: number;
}

/**
 * A single search result
 */
export interface SearchResult {
  /** Page GUID */
  pageId: string;
  /** Short code for URL-friendly links */
  shortCode?: string;
  /** Page title */
  title: string;
  /** Snippet of matching content with context */
  snippet: string;
  /** Relevance score (higher = more relevant) */
  relevanceScore: number;
  /** Number of matches found */
  matchCount: number;
  /** Hierarchical path (e.g., "Parent > Child > Page") */
  path: string;
  /** Tags on the page */
  tags: string[];
}

/**
 * Search result set with metadata
 */
export interface SearchResultSet {
  /** Array of search results */
  results: SearchResult[];
  /** Total number of matching results (may exceed results.length due to pagination) */
  totalResults: number;
  /** Time taken to execute the search in milliseconds */
  executionTimeMs: number;
}

/**
 * Capabilities that a search provider supports
 */
export interface SearchCapabilities {
  /** Whether the provider supports fuzzy/approximate matching */
  fuzzySearch: boolean;
  /** Whether the provider supports faceted search (filter by metadata) */
  faceting: boolean;
  /** Whether the provider supports term highlighting in snippets */
  highlighting: boolean;
  /** Estimated monthly cost in USD */
  estimatedMonthlyCost: number;
}

/**
 * Configuration for a search provider
 */
export interface SearchProviderConfig {
  /** Provider type identifier (e.g., 'client-side', 'dynamodb', 's3-vectors') */
  type: string;
  /** Provider-specific configuration */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Entry in the client-side search index (downloaded by the browser)
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
  /** Searchable text from custom properties (string and tags values) */
  propertyText?: string;
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
 * Current schema version for the client search index
 */
export const CLIENT_SEARCH_INDEX_VERSION = 1;
