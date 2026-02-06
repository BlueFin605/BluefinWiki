/**
 * Storage Plugin Interface
 * 
 * This interface defines the contract that all storage plugins must implement.
 * Storage plugins are responsible for persisting pages/folders to various backends
 * (S3, GitHub, local filesystem, etc.).
 * 
 * Architecture Note:
 * - Pages ARE folders: A page is a .md file, and if it has children, 
 *   they are stored in a directory named {page-guid}/
 * - Root pages: stored at {guid}.md
 * - Child pages: stored at {parent-guid}/{guid}.md
 * - This enables hierarchical organization without a separate folder concept
 */

import { PageContent, Version, PageSummary } from '../types/index.js';

export interface StoragePlugin {
  /**
   * Save a page with its content and metadata
   * 
   * @param guid - Unique identifier for the page (UUID v4)
   * @param parentGuid - Parent page GUID (null for root-level pages)
   * @param content - Page content with metadata
   * @returns Promise that resolves when save is complete
   * @throws StoragePluginError if save fails
   */
  savePage(
    guid: string,
    parentGuid: string | null,
    content: PageContent
  ): Promise<void>;

  /**
   * Load a page by its GUID
   * 
   * @param guid - Unique identifier for the page
   * @returns Promise with page content and metadata
   * @throws StoragePluginError if page not found or load fails
   */
  loadPage(guid: string): Promise<PageContent>;

  /**
   * Delete a page and optionally all its children
   * 
   * @param guid - Unique identifier for the page
   * @param recursive - If true, delete all child pages; if false, only delete if no children
   * @returns Promise that resolves when deletion is complete
   * @throws StoragePluginError if page has children and recursive=false, or if delete fails
   */
  deletePage(guid: string, recursive?: boolean): Promise<void>;

  /**
   * List all versions of a page
   * 
   * @param guid - Unique identifier for the page
   * @returns Promise with array of versions, sorted newest first
   * @throws StoragePluginError if page not found or listing fails
   */
  listVersions(guid: string): Promise<Version[]>;

  /**
   * List all child pages of a parent (or root-level pages)
   * 
   * @param parentGuid - Parent page GUID (null for root-level pages)
   * @returns Promise with array of page summaries
   * @throws StoragePluginError if listing fails
   */
  listChildren(parentGuid: string | null): Promise<PageSummary[]>;

  /**
   * Move a page to a new parent (or to root level)
   * 
   * @param guid - Unique identifier for the page to move
   * @param newParentGuid - New parent page GUID (null for root level)
   * @returns Promise that resolves when move is complete
   * @throws StoragePluginError if circular reference detected or move fails
   */
  movePage(guid: string, newParentGuid: string | null): Promise<void>;

  /**
   * Check if the storage plugin is properly configured and accessible
   * 
   * @returns Promise that resolves to true if healthy, false otherwise
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get the plugin type identifier
   * 
   * @returns Plugin type (e.g., 's3', 'github', 'local')
   */
  getType(): string;
}
