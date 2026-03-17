/**
 * Client-Side Search Service
 *
 * Uses Fuse.js to provide full-text search entirely in the browser.
 * Downloads a search index JSON from the API/S3 and runs queries locally.
 *
 * Features:
 * - Weighted search: title (10x) > tags (5x) > content (1x)
 * - Fuzzy matching with configurable threshold
 * - Folder-scoped search (filter by path prefix)
 * - Title-only search mode
 * - Snippet generation with match context
 * - Index refresh on visibility change or periodic poll
 */

import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';
import type {
  ClientSearchIndex,
  ClientSearchIndexEntry,
  WikiSearchQuery,
  WikiSearchResult,
  WikiSearchResultSet,
} from '../types/search';

/** Default Fuse.js configuration */
const FUSE_OPTIONS: IFuseOptions<ClientSearchIndexEntry> = {
  keys: [
    { name: 'title', weight: 10 },
    { name: 'tags', weight: 5 },
    { name: 'content', weight: 1 },
  ],
  threshold: 0.3,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  findAllMatches: false,
  ignoreLocation: true,
};

/** Title-only Fuse.js configuration */
const FUSE_TITLE_ONLY_OPTIONS: IFuseOptions<ClientSearchIndexEntry> = {
  keys: [{ name: 'title', weight: 1 }],
  threshold: 0.3,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
};

/** Snippet length in characters */
const SNIPPET_LENGTH = 250;

/** Index refresh interval in ms (5 minutes) */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Generate a snippet with context around the first match
 */
function generateSnippet(content: string, query: string): string {
  if (!content) return '';

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) {
    // No exact match; return beginning of content
    return content.length > SNIPPET_LENGTH
      ? content.substring(0, SNIPPET_LENGTH) + '...'
      : content;
  }

  // Center the snippet around the match
  const halfSnippet = Math.floor(SNIPPET_LENGTH / 2);
  let start = Math.max(0, matchIndex - halfSnippet);
  let end = Math.min(content.length, matchIndex + lowerQuery.length + halfSnippet);

  // Adjust to word boundaries
  if (start > 0) {
    const spaceIndex = content.indexOf(' ', start);
    if (spaceIndex !== -1 && spaceIndex < matchIndex) {
      start = spaceIndex + 1;
    }
  }
  if (end < content.length) {
    const spaceIndex = content.lastIndexOf(' ', end);
    if (spaceIndex > matchIndex + lowerQuery.length) {
      end = spaceIndex;
    }
  }

  let snippet = content.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Convert Fuse.js score (0 = perfect, 1 = worst) to relevance score (0-1000)
 */
function fuseScoreToRelevance(score: number | undefined): number {
  if (score === undefined) return 0;
  return Math.round((1 - score) * 1000);
}

/**
 * Count occurrences of query in text (case-insensitive)
 */
function countMatches(text: string, query: string): number {
  if (!text || !query) return 0;
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return (text.match(regex) || []).length;
}

export class ClientSearchService {
  private index: ClientSearchIndex | null = null;
  private fuse: Fuse<ClientSearchIndexEntry> | null = null;
  private fuseTitleOnly: Fuse<ClientSearchIndexEntry> | null = null;
  private indexUrl: string;
  private lastFetchTime = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(indexUrl?: string) {
    this.indexUrl = indexUrl || '/api/search-index.json';
  }

  /**
   * Load or refresh the search index
   */
  async loadIndex(forceRefresh = false): Promise<void> {
    const now = Date.now();
    if (!forceRefresh && this.index && (now - this.lastFetchTime) < REFRESH_INTERVAL_MS) {
      return; // Index is fresh enough
    }

    try {
      const response = await fetch(this.indexUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch search index: ${response.status}`);
      }

      const data: ClientSearchIndex = await response.json();
      this.setIndex(data);
      this.lastFetchTime = now;
    } catch (error) {
      // If we already have an index, log warning but don't fail
      if (this.index) {
        console.warn('Failed to refresh search index, using cached version:', error);
        return;
      }
      throw error;
    }
  }

  /**
   * Set the search index directly (useful for testing or pre-loading)
   */
  setIndex(index: ClientSearchIndex): void {
    this.index = index;
    this.fuse = new Fuse(index.entries, FUSE_OPTIONS);
    this.fuseTitleOnly = new Fuse(index.entries, FUSE_TITLE_ONLY_OPTIONS);
  }

  /**
   * Search the index
   */
  async search(query: WikiSearchQuery): Promise<WikiSearchResultSet> {
    const startTime = performance.now();

    // Sanitize query: enforce max length and strip potentially dangerous characters
    const sanitizedText = query.text
      .slice(0, 500)
      .replace(/[<>]/g, '');
    query = { ...query, text: sanitizedText };

    // Ensure index is loaded
    await this.loadIndex();

    if (!this.fuse || !this.fuseTitleOnly || !this.index) {
      return { results: [], totalResults: 0, executionTimeMs: 0 };
    }

    if (!query.text || query.text.trim() === '') {
      return { results: [], totalResults: 0, executionTimeMs: 0 };
    }

    // Choose the right Fuse instance
    const fuseInstance = query.titleOnly ? this.fuseTitleOnly : this.fuse;

    // Run Fuse.js search
    let fuseResults: FuseResult<ClientSearchIndexEntry>[] = fuseInstance.search(query.text);

    // Apply folder scope filter
    if (query.scope && query.scope !== 'all') {
      fuseResults = fuseResults.filter(result =>
        result.item.path.startsWith(query.scope)
      );
    }

    const totalResults = fuseResults.length;

    // Apply pagination
    const paginatedResults = fuseResults.slice(query.offset, query.offset + query.limit);

    // Map to WikiSearchResult
    const results: WikiSearchResult[] = paginatedResults.map(result => ({
      pageId: result.item.id,
      title: result.item.title,
      snippet: generateSnippet(result.item.content, query.text),
      relevanceScore: fuseScoreToRelevance(result.score),
      matchCount:
        countMatches(result.item.title, query.text) +
        countMatches(result.item.content, query.text) +
        result.item.tags.filter(t => t.toLowerCase().includes(query.text.toLowerCase())).length,
      path: result.item.path,
      tags: result.item.tags,
    }));

    const executionTimeMs = Math.round(performance.now() - startTime);

    return { results, totalResults, executionTimeMs };
  }

  /**
   * Start automatic index refresh on visibility change and periodic poll
   */
  startAutoRefresh(): void {
    this.stopAutoRefresh();

    // Refresh when tab becomes visible
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.loadIndex().catch(console.warn);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Periodic refresh
    this.refreshTimer = setInterval(() => {
      this.loadIndex().catch(console.warn);
    }, REFRESH_INTERVAL_MS);
  }

  /**
   * Stop automatic index refresh
   */
  stopAutoRefresh(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Check if the index is loaded
   */
  isIndexLoaded(): boolean {
    return this.index !== null;
  }

  /**
   * Get the index metadata
   */
  getIndexInfo(): { version: number; builtAt: string; totalPages: number } | null {
    if (!this.index) return null;
    return {
      version: this.index.version,
      builtAt: this.index.builtAt,
      totalPages: this.index.totalPages,
    };
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this.stopAutoRefresh();
    this.index = null;
    this.fuse = null;
    this.fuseTitleOnly = null;
  }
}
