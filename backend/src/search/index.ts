/**
 * Search Module Exports
 *
 * This module provides the pluggable search architecture for BlueFinWiki.
 */

// Core interfaces and types
export type { ISearchProvider } from './SearchProvider.js';
export type {
  SearchQuery,
  SearchResult,
  SearchResultSet,
  SearchCapabilities,
  SearchProviderConfig,
  ClientSearchIndex,
  ClientSearchIndexEntry,
} from './SearchTypes.js';
export { CLIENT_SEARCH_INDEX_VERSION } from './SearchTypes.js';

// Registry and factory
export {
  SearchProviderRegistry,
  SearchProviderFactory,
  getSearchProvider,
  initializeSearchProvider,
  resetSearchProvider,
  isSearchProviderInitialized,
} from './SearchProviderRegistry.js';
