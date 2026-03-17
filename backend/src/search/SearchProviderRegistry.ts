/**
 * Search Provider Registry and Factory
 *
 * Manages search provider implementations and creates instances
 * based on configuration. Follows the same pattern as StoragePluginRegistry.
 */

import { ISearchProvider } from './SearchProvider.js';
import { SearchProviderConfig } from './SearchTypes.js';

type SearchProviderConstructor = new (config: Record<string, unknown>) => ISearchProvider;

/**
 * Registry for search provider implementations
 */
class ProviderRegistry {
  private providers: Map<string, SearchProviderConstructor> = new Map();

  /**
   * Register a search provider implementation
   *
   * @param type - Provider type identifier (e.g., 'client-side', 'dynamodb')
   * @param providerClass - Provider class constructor
   */
  register(type: string, providerClass: SearchProviderConstructor): void {
    if (this.providers.has(type)) {
      throw new Error(`Search provider type '${type}' is already registered`);
    }
    this.providers.set(type, providerClass);
  }

  /**
   * Get a registered provider class
   *
   * @param type - Provider type identifier
   * @returns Provider class constructor
   * @throws Error if provider type is not registered
   */
  get(type: string): SearchProviderConstructor {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(
        `Search provider type '${type}' is not registered. ` +
        `Available types: ${Array.from(this.providers.keys()).join(', ') || 'none'}`
      );
    }
    return provider;
  }

  /**
   * Check if a provider type is registered
   */
  has(type: string): boolean {
    return this.providers.has(type);
  }

  /**
   * Get all registered provider types
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Clear all registered providers (for testing)
   */
  clear(): void {
    this.providers.clear();
  }
}

// Singleton registry instance
export const SearchProviderRegistry = new ProviderRegistry();

/**
 * Factory for creating search provider instances
 */
export class SearchProviderFactory {
  /**
   * Create a search provider instance from configuration
   *
   * @param config - Provider configuration including type
   * @returns Initialized search provider instance
   */
  static create(config: SearchProviderConfig): ISearchProvider {
    if (!config.type) {
      throw new Error('Search provider type is required in configuration');
    }

    const ProviderClass = SearchProviderRegistry.get(config.type);

    try {
      return new ProviderClass(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to initialize search provider '${config.type}': ${message}`
      );
    }
  }

  /**
   * Create a search provider from environment variables
   *
   * Reads SEARCH_PROVIDER_TYPE from environment.
   * Falls back to 'client-side' if not set.
   */
  static fromEnvironment(): ISearchProvider {
    const type = process.env.SEARCH_PROVIDER_TYPE || 'client-side';

    const config: SearchProviderConfig = { type };

    return this.create(config);
  }
}

/**
 * Singleton search provider instance
 */
let globalProviderInstance: ISearchProvider | null = null;

/**
 * Get the global search provider instance
 *
 * @returns The initialized search provider
 * @throws Error if no provider is registered for the configured type
 */
export function getSearchProvider(): ISearchProvider {
  if (!globalProviderInstance) {
    globalProviderInstance = SearchProviderFactory.fromEnvironment();
  }
  return globalProviderInstance;
}

/**
 * Initialize the global search provider instance
 *
 * @param config - Provider configuration (if not provided, reads from environment)
 * @returns The initialized search provider
 */
export function initializeSearchProvider(
  config?: SearchProviderConfig
): ISearchProvider {
  if (globalProviderInstance) {
    throw new Error('Search provider already initialized');
  }

  globalProviderInstance = config
    ? SearchProviderFactory.create(config)
    : SearchProviderFactory.fromEnvironment();

  return globalProviderInstance;
}

/**
 * Reset the global search provider instance (for testing)
 */
export function resetSearchProvider(): void {
  globalProviderInstance = null;
}

/**
 * Check if search provider is initialized
 */
export function isSearchProviderInitialized(): boolean {
  return globalProviderInstance !== null;
}
