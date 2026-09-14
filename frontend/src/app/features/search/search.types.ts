/**
 * Search types for BlueFinWiki Angular frontend.
 *
 * Ports `frontend/src/types/search.ts` byte-for-byte — search runs on the
 * backend (Bedrock embeddings + S3 Vectors); the frontend only sends queries
 * and renders results.
 */

/**
 * Search query sent to the backend.
 */
export interface WikiSearchQuery {
  /** The search text */
  text: string;
  /** Search scope: 'all' or a folder path prefix */
  // 'all' is treated specially by the backend; other strings are folder path prefixes.
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  scope: 'all' | string;
  /** Maximum results to return */
  limit: number;
  /** Offset for pagination */
  offset: number;
}

/**
 * A single search result displayed in the UI.
 */
export interface WikiSearchResult {
  /** Page GUID */
  pageId: string;
  /** Page title */
  title: string;
  /** Content snippet for display */
  snippet: string;
  /** Relevance score (0-1000) */
  relevanceScore: number;
  /** Reserved — always 0 for semantic search */
  matchCount: number;
  /** Hierarchical path */
  path: string;
  /** Tags */
  tags: string[];
}

/**
 * Result set returned by the backend.
 */
export interface WikiSearchResultSet {
  results: WikiSearchResult[];
  totalResults: number;
  executionTimeMs: number;
}

/**
 * Page-size choices exposed by the search dialog's selector (step 6.2). The
 * backend (`backend/src/search/search-query.ts`) paginates by plain
 * `offset`/`limit` — it slices an already-ranked hit list and returns
 * `totalResults` alongside the page — so there is no cursor to model; any of
 * these values is valid as `WikiSearchQuery.limit` (backend ceiling is 50).
 */
export type SearchPageSize = 10 | 25 | 50;
