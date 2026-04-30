/**
 * Search types for BlueFinWiki frontend
 *
 * Types for the search dialog. Search itself runs on the backend
 * (Bedrock embeddings + S3 Vectors); the frontend only sends queries
 * and renders results.
 */

/**
 * Search query sent to the backend.
 */
export interface WikiSearchQuery {
  /** The search text */
  text: string;
  /** Search scope: 'all' or a folder path prefix */
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
