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

import {
  PageContent,
  Version,
  PageSummary,
  AttachmentUploadInput,
  AttachmentUploadResult,
  AttachmentMetadata,
} from '../types/index.js';

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
   * Upload an attachment for a page
   *
   * @param pageGuid - Page GUID to attach to
   * @param file - Attachment file details
   * @returns Upload result with filename and storage key
   */
  uploadAttachment(pageGuid: string, file: AttachmentUploadInput): Promise<AttachmentUploadResult>;

  /**
   * Delete an attachment from a page
   *
   * @param pageGuid - Page GUID
   * @param filename - Attachment filename
   */
  deleteAttachment(pageGuid: string, filename: string): Promise<void>;

  /**
   * Save sidecar metadata for an attachment
   *
   * @param pageGuid - Page GUID
   * @param filename - Attachment filename
   * @param metadata - Attachment metadata payload
   */
  saveAttachmentMetadata(pageGuid: string, filename: string, metadata: AttachmentMetadata): Promise<void>;

  /**
   * Get sidecar metadata for an attachment
   *
   * @param pageGuid - Page GUID
   * @param filename - Attachment filename
   * @returns Attachment metadata
   */
  getAttachmentMetadata(pageGuid: string, filename: string): Promise<AttachmentMetadata>;

  /**
   * List all attachments for a page
   *
   * @param pageGuid - Page GUID
   * @returns Sorted attachment metadata (newest first)
   */
  listAttachments(pageGuid: string): Promise<AttachmentMetadata[]>;

  /**
   * Get a temporary URL for attachment download
   *
   * @param pageGuid - Page GUID
   * @param filename - Attachment filename
   * @returns Temporary URL
   */
  getAttachmentUrl(pageGuid: string, filename: string): Promise<string>;

  /**
   * Generate a presigned PUT URL for direct-to-S3 attachment upload
   *
   * @param pageGuid - Page GUID
   * @param filename - Attachment filename
   * @param contentType - MIME type of the file
   * @returns Presigned URL and the final S3 key
   */
  getAttachmentUploadUrl(pageGuid: string, filename: string, contentType: string): Promise<{ uploadUrl: string; attachmentKey: string }>;

  /**
   * Get ancestors of a page (for breadcrumbs)
   * Returns an array of page summaries from root to immediate parent
   * 
   * @param guid - Page GUID to get ancestors for
   * @returns Promise with array of ancestors (root first, immediate parent last)
   */
  getAncestors(guid: string): Promise<PageSummary[]>;

  /**
   * Check if a page is a descendant of another page
   * Used for circular reference prevention
   * 
   * @param pageGuid - The page to check
   * @param ancestorGuid - The potential ancestor
   * @returns Promise that resolves to true if pageGuid is a descendant of ancestorGuid
   */
  isDescendantOf(pageGuid: string, ancestorGuid: string): Promise<boolean>;

  /**
   * Build a complete page tree from storage
   * Returns all pages organized in a hierarchical structure
   * 
   * @returns Promise with array of root page summaries, each with children populated
   */
  buildPageTree(): Promise<PageSummary[]>;

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
