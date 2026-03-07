/**
 * Storage Module Exports
 * 
 * This module provides the pluggable storage architecture for BlueFinWiki.
 */

// Core interfaces and types
export type { StoragePlugin } from './StoragePlugin.js';
export { BaseStoragePlugin } from './BaseStoragePlugin.js';

// Concrete implementations
export { S3StoragePlugin } from './S3StoragePlugin.js';

// Registry and factory
export {
  StoragePluginRegistry,
  StoragePluginFactory,
  getStoragePlugin,
  initializeStoragePlugin,
  resetStoragePlugin,
  isStoragePluginInitialized,
} from './StoragePluginRegistry.js';

// Re-export storage-related types from main types module
export type {
  PageContent,
  Version,
  PageSummary,
  AttachmentUploadInput,
  AttachmentUploadResult,
  AttachmentMetadata,
  StoragePluginConfig,
  StoragePluginError,
} from '../types/index.js';
