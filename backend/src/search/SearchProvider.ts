/**
 * Search Provider Interface
 *
 * Defines the contract that all search providers must implement.
 * Search providers are responsible for indexing and searching wiki pages.
 *
 * Architecture follows the same plugin pattern as StoragePlugin:
 * - Interface defines the contract
 * - Registry manages available providers
 * - Factory creates provider instances from config
 */

import {
  SearchQuery,
  SearchResultSet,
  SearchCapabilities,
} from './SearchTypes.js';

/**
 * Interface that all search providers must implement
 */
export interface ISearchProvider {
  /**
   * Index a page for searching. Called on page create/update.
   *
   * @param pageId - Page GUID
   * @param title - Page title
   * @param content - Raw markdown content
   * @param metadata - Additional metadata (tags, path, author, modifiedDate)
   */
  indexPage(
    pageId: string,
    title: string,
    content: string,
    metadata: {
      tags: string[];
      path: string;
      author: string;
      modifiedDate: string;
      shortCode?: string;
    }
  ): Promise<void>;

  /**
   * Search for pages matching the query
   *
   * @param query - Search query parameters
   * @returns Search result set with results, total count, and execution time
   */
  search(query: SearchQuery): Promise<SearchResultSet>;

  /**
   * Remove a page from the search index. Called on page delete.
   *
   * @param pageId - Page GUID to remove
   */
  deletePage(pageId: string): Promise<void>;

  /**
   * Rebuild the entire search index from scratch.
   *
   * @param pages - All pages to index
   */
  reindexAll(
    pages: Array<{
      pageId: string;
      title: string;
      content: string;
      metadata: {
        tags: string[];
        path: string;
        author: string;
        modifiedDate: string;
        shortCode?: string;
      };
    }>
  ): Promise<void>;

  /**
   * Get the capabilities of this search provider
   */
  getCapabilities(): SearchCapabilities;

  /**
   * Get the provider type identifier
   */
  getType(): string;
}
