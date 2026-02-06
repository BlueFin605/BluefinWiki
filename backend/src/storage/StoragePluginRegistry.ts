/**
 * Storage Plugin Registry and Factory
 * 
 * This module provides a registry for storage plugins and a factory
 * for creating plugin instances based on configuration.
 */

import { StoragePlugin } from './StoragePlugin.js';
import { StoragePluginConfig } from '../types/index.js';

type StoragePluginConstructor = new (config: any) => StoragePlugin;

/**
 * Registry for storage plugin implementations
 */
class PluginRegistry {
  private plugins: Map<string, StoragePluginConstructor> = new Map();

  /**
   * Register a storage plugin implementation
   * 
   * @param type - Plugin type identifier (e.g., 's3', 'github')
   * @param pluginClass - Plugin class constructor
   */
  register(type: string, pluginClass: StoragePluginConstructor): void {
    if (this.plugins.has(type)) {
      throw new Error(`Storage plugin type '${type}' is already registered`);
    }
    this.plugins.set(type, pluginClass);
  }

  /**
   * Get a registered plugin class
   * 
   * @param type - Plugin type identifier
   * @returns Plugin class constructor
   * @throws Error if plugin type is not registered
   */
  get(type: string): StoragePluginConstructor {
    const plugin = this.plugins.get(type);
    if (!plugin) {
      throw new Error(
        `Storage plugin type '${type}' is not registered. ` +
        `Available types: ${Array.from(this.plugins.keys()).join(', ')}`
      );
    }
    return plugin;
  }

  /**
   * Check if a plugin type is registered
   * 
   * @param type - Plugin type identifier
   * @returns true if registered
   */
  has(type: string): boolean {
    return this.plugins.has(type);
  }

  /**
   * Get all registered plugin types
   * 
   * @returns Array of plugin type identifiers
   */
  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Clear all registered plugins (mainly for testing)
   */
  clear(): void {
    this.plugins.clear();
  }
}

// Singleton registry instance
export const StoragePluginRegistry = new PluginRegistry();

/**
 * Factory for creating storage plugin instances
 */
export class StoragePluginFactory {
  /**
   * Create a storage plugin instance from configuration
   * 
   * @param config - Plugin configuration including type and plugin-specific settings
   * @returns Initialized storage plugin instance
   * @throws Error if plugin type is not registered or initialization fails
   * 
   * @example
   * ```typescript
   * const plugin = StoragePluginFactory.create({
   *   type: 's3',
   *   bucket: 'my-wiki-bucket',
   *   region: 'us-east-1'
   * });
   * ```
   */
  static create(config: StoragePluginConfig): StoragePlugin {
    if (!config.type) {
      throw new Error('Storage plugin type is required in configuration');
    }

    const PluginClass = StoragePluginRegistry.get(config.type);

    try {
      return new PluginClass(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to initialize storage plugin '${config.type}': ${message}`
      );
    }
  }

  /**
   * Create a storage plugin from environment variables
   * 
   * Reads configuration from environment:
   * - STORAGE_PLUGIN_TYPE: Plugin type (required)
   * - Additional plugin-specific environment variables
   * 
   * @returns Initialized storage plugin instance
   * @throws Error if required environment variables are missing
   * 
   * @example
   * ```typescript
   * // Set env vars:
   * // STORAGE_PLUGIN_TYPE=s3
   * // S3_BUCKET=my-wiki-bucket
   * // S3_REGION=us-east-1
   * 
   * const plugin = StoragePluginFactory.fromEnvironment();
   * ```
   */
  static fromEnvironment(): StoragePlugin {
    const type = process.env.STORAGE_PLUGIN_TYPE;

    if (!type) {
      throw new Error(
        'STORAGE_PLUGIN_TYPE environment variable is required'
      );
    }

    // Plugin-specific config will be read by the plugin constructor
    const config: StoragePluginConfig = {
      type: type as any,
    };

    return this.create(config);
  }
}

/**
 * Singleton storage plugin instance
 * 
 * This provides a global instance for use across Lambda functions.
 * The instance is created lazily on first access.
 */
let globalPluginInstance: StoragePlugin | null = null;

/**
 * Get the global storage plugin instance
 * 
 * @returns The initialized storage plugin
 * @throws Error if plugin has not been initialized
 * 
 * @example
 * ```typescript
 * // In Lambda handler:
 * const storage = getStoragePlugin();
 * const page = await storage.loadPage(pageGuid);
 * ```
 */
export function getStoragePlugin(): StoragePlugin {
  if (!globalPluginInstance) {
    throw new Error(
      'Storage plugin not initialized. Call initializeStoragePlugin() first.'
    );
  }
  return globalPluginInstance;
}

/**
 * Initialize the global storage plugin instance
 * 
 * This should be called once at Lambda cold start.
 * 
 * @param config - Plugin configuration (if not provided, reads from environment)
 * @returns The initialized storage plugin
 * 
 * @example
 * ```typescript
 * // In Lambda initialization:
 * initializeStoragePlugin({
 *   type: 's3',
 *   bucket: 'my-wiki-bucket',
 *   region: 'us-east-1'
 * });
 * 
 * // Or from environment:
 * initializeStoragePlugin();
 * ```
 */
export function initializeStoragePlugin(
  config?: StoragePluginConfig
): StoragePlugin {
  if (globalPluginInstance) {
    throw new Error('Storage plugin already initialized');
  }

  globalPluginInstance = config
    ? StoragePluginFactory.create(config)
    : StoragePluginFactory.fromEnvironment();

  return globalPluginInstance;
}

/**
 * Reset the global storage plugin instance (for testing)
 */
export function resetStoragePlugin(): void {
  globalPluginInstance = null;
}

/**
 * Check if storage plugin is initialized
 * 
 * @returns true if initialized
 */
export function isStoragePluginInitialized(): boolean {
  return globalPluginInstance !== null;
}
