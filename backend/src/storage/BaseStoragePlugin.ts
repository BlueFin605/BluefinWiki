/**
 * Abstract Base Storage Plugin
 * 
 * This abstract class provides common functionality for all storage plugins,
 * including error handling, validation, and circular reference detection.
 * Concrete plugins (S3, GitHub, etc.) should extend this class.
 */

import { v4 as uuidv4, validate as validateUUID } from 'uuid';
import { StoragePlugin } from './StoragePlugin.js';
import {
  PageContent,
  Version,
  PageSummary,
  StoragePluginError,
  AttachmentUploadInput,
  AttachmentUploadResult,
  AttachmentMetadata,
} from '../types/index.js';

export abstract class BaseStoragePlugin implements StoragePlugin {
  protected readonly pluginType: string;

  constructor(pluginType: string) {
    this.pluginType = pluginType;
  }

  /**
   * Generate a new UUID v4 for a page
   */
  protected generateGuid(): string {
    return uuidv4();
  }

  /**
   * Validate that a string is a valid UUID
   */
  protected validateGuid(guid: string): boolean {
    return validateUUID(guid);
  }

  /**
   * Create a standardized error
   */
  protected createError(
    message: string,
    code: string,
    statusCode?: number,
    details?: Record<string, string | number | boolean | null>
  ): StoragePluginError {
    const error = new Error(message) as StoragePluginError;
    error.code = code;
    error.statusCode = statusCode;
    error.details = details;
    return error;
  }

  /**
   * Validate page content before saving
   */
  protected validatePageContent(content: PageContent): void {
    if (!content.guid) {
      throw this.createError('Page GUID is required', 'INVALID_PAGE_CONTENT', 400);
    }

    if (!this.validateGuid(content.guid)) {
      throw this.createError('Invalid page GUID format', 'INVALID_GUID', 400);
    }

    if (!content.title || content.title.trim().length === 0) {
      throw this.createError('Page title is required', 'INVALID_PAGE_CONTENT', 400);
    }

    if (!content.createdBy || !content.modifiedBy) {
      throw this.createError('Creator and modifier user IDs are required', 'INVALID_PAGE_CONTENT', 400);
    }

    if (!['draft', 'published', 'archived', 'deleted'].includes(content.status)) {
      throw this.createError('Invalid page status', 'INVALID_PAGE_CONTENT', 400);
    }
  }

  /**
   * Validate that a move operation won't create a circular reference
   * This method should be called before moving a page
   * 
   * @param guid - The page being moved
   * @param newParentGuid - The target parent
   * @returns Promise that resolves if move is valid
   * @throws StoragePluginError if circular reference detected
   */
  protected async validateNoCircularReference(
    guid: string,
    newParentGuid: string | null
  ): Promise<void> {
    if (newParentGuid === null) {
      // Moving to root is always safe
      return;
    }

    if (guid === newParentGuid) {
      throw this.createError(
        'Cannot move a page to itself',
        'CIRCULAR_REFERENCE',
        400
      );
    }

    // Check if newParentGuid is a descendant of guid
    let currentGuid: string | null = newParentGuid;
    const visited = new Set<string>([guid]);

    while (currentGuid !== null) {
      if (visited.has(currentGuid)) {
        throw this.createError(
          'Circular reference detected: target parent is a descendant of the page being moved',
          'CIRCULAR_REFERENCE',
          400
        );
      }

      visited.add(currentGuid);

      try {
        const parentPage = await this.loadPage(currentGuid);
        currentGuid = parentPage.folderId || null;
      } catch (error) {
        // If we can't load the parent, assume it's root or doesn't exist
        break;
      }
    }
  }

  /**
   * Check if a page has children
   * 
   * @param guid - Page GUID to check
   * @returns Promise that resolves to true if page has children
   */
  protected async hasChildren(guid: string): Promise<boolean> {
    const children = await this.listChildren(guid);
    return children.length > 0;
  }

  /**
   * Get ancestors of a page (for breadcrumbs)
   * Returns an array of page summaries from root to immediate parent
   * 
   * @param guid - Page GUID to get ancestors for
   * @returns Promise with array of ancestors (root first, immediate parent last)
   */
  async getAncestors(guid: string): Promise<PageSummary[]> {
    const ancestors: PageSummary[] = [];
    
    try {
      const page = await this.loadPage(guid);
      let currentParentGuid: string | null = page.folderId || null;

      while (currentParentGuid !== null && currentParentGuid !== '') {
        try {
          const parentPage = await this.loadPage(currentParentGuid);
          const parentSummary: PageSummary = {
            guid: parentPage.guid,
            title: parentPage.title,
            parentGuid: parentPage.folderId || null,
            status: parentPage.status === 'deleted' ? 'archived' : parentPage.status,
            modifiedAt: parentPage.modifiedAt,
            modifiedBy: parentPage.modifiedBy,
            hasChildren: true, // Has at least one child (current page)
          };
          
          ancestors.unshift(parentSummary); // Add to beginning
          currentParentGuid = parentPage.folderId || null;
        } catch (error) {
          // If we can't load a parent, stop traversing
          break;
        }
      }
    } catch (error) {
      // If we can't load the initial page, return empty array
      return [];
    }

    return ancestors;
  }

  /**
   * Check if a page is a descendant of another page
   * Used for circular reference prevention
   * 
   * @param pageGuid - The page to check
   * @param ancestorGuid - The potential ancestor
   * @returns Promise that resolves to true if pageGuid is a descendant of ancestorGuid
   */
  async isDescendantOf(pageGuid: string, ancestorGuid: string): Promise<boolean> {
    if (pageGuid === ancestorGuid) {
      return true;
    }

    try {
      const page = await this.loadPage(pageGuid);
      let currentParentGuid: string | null = page.folderId || null;
      const visited = new Set<string>([pageGuid]);

      while (currentParentGuid !== null && currentParentGuid !== '') {
        if (currentParentGuid === ancestorGuid) {
          return true;
        }

        if (visited.has(currentParentGuid)) {
          // Circular reference detected, stop
          break;
        }

        visited.add(currentParentGuid);

        try {
          const parentPage = await this.loadPage(currentParentGuid);
          currentParentGuid = parentPage.folderId || null;
        } catch (error) {
          // Can't load parent, stop traversing
          break;
        }
      }
    } catch (error) {
      // Can't load the initial page
      return false;
    }

    return false;
  }

  /**
   * Build a complete page tree from storage
   * Returns all pages organized in a hierarchical structure
   * 
   * @returns Promise with array of root page summaries, each with children populated
   */
  async buildPageTree(): Promise<PageSummary[]> {
    // Get all root pages
    const rootPages = await this.listChildren(null);
    
    // Recursively load children for each root page
    for (const page of rootPages) {
      await this.loadPageChildren(page);
    }

    return rootPages;
  }

  /**
   * Recursively load children for a page summary
   * Modifies the page object in place
   * 
   * @param page - PageSummary to load children for
   */
  private async loadPageChildren(page: PageSummary & { children?: PageSummary[] }): Promise<void> {
    if (!page.hasChildren) {
      page.children = [];
      return;
    }

    const children = await this.listChildren(page.guid);
    page.children = children;

    // Recursively load children for each child
    for (const child of children) {
      await this.loadPageChildren(child as PageSummary & { children?: PageSummary[] });
    }
  }

  /**
   * Format a date to ISO 8601 string
   */
  protected formatDate(date: Date = new Date()): string {
    return date.toISOString();
  }

  // Abstract methods that must be implemented by concrete plugins

  abstract savePage(
    guid: string,
    parentGuid: string | null,
    content: PageContent
  ): Promise<void>;

  abstract loadPage(guid: string): Promise<PageContent>;

  abstract deletePage(guid: string, recursive?: boolean): Promise<void>;

  abstract listVersions(guid: string): Promise<Version[]>;

  abstract listChildren(parentGuid: string | null): Promise<PageSummary[]>;

  abstract movePage(guid: string, newParentGuid: string | null): Promise<void>;

  abstract uploadAttachment(pageGuid: string, file: AttachmentUploadInput): Promise<AttachmentUploadResult>;

  abstract deleteAttachment(pageGuid: string, filename: string): Promise<void>;

  abstract saveAttachmentMetadata(pageGuid: string, filename: string, metadata: AttachmentMetadata): Promise<void>;

  abstract getAttachmentMetadata(pageGuid: string, filename: string): Promise<AttachmentMetadata>;

  abstract listAttachments(pageGuid: string): Promise<AttachmentMetadata[]>;

  abstract getAttachmentUrl(pageGuid: string, filename: string): Promise<string>;

  abstract getAttachmentUploadUrl(pageGuid: string, filename: string, contentType: string): Promise<{ uploadUrl: string; attachmentKey: string }>;

  abstract healthCheck(): Promise<boolean>;

  getType(): string {
    return this.pluginType;
  }
}
