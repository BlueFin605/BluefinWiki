/**
 * S3 Storage Plugin
 * 
 * Implements storage plugin interface using AWS S3 for page persistence.
 * 
 * Architecture:
 * - Every page: stored at {bucket}/{guid}/{guid}.md (page content always inside its own folder)
 * - Child pages: stored at {bucket}/{parent-guid}/{child-guid}/{child-guid}.md
 * - Multi-level nesting: {bucket}/{grandparent-guid}/{parent-guid}/{child-guid}/{child-guid}.md
 * - Page metadata stored in YAML frontmatter
 * - S3 versioning enabled for history tracking
 * 
 * File Format:
 * ```
 * ---
 * title: "Page Title"
 * guid: "abc-123"
 * parentGuid: "parent-guid" (optional)
 * status: "published"
 * tags: ["tag1", "tag2"]
 * createdBy: "user-id"
 * modifiedBy: "user-id"
 * createdAt: "2026-02-06T12:00:00Z"
 * modifiedAt: "2026-02-06T12:00:00Z"
 * folderId: "parent-guid"
 * ---
 * 
 * # Markdown content starts here
 * ```
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  HeadObjectCommand,
  CopyObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { BaseStoragePlugin } from './BaseStoragePlugin.js';

/**
 * Page index interface — allows injection of the DynamoDB page index
 * without creating a hard dependency on the DynamoDB SDK at import time.
 */
export interface PageIndexProvider {
  getPageKey(guid: string): Promise<string | null>;
  putPageKey(record: { guid: string; s3Key: string; parentGuid: string | null; title: string; updatedAt: string }): Promise<void>;
  deletePageKey(guid: string): Promise<void>;
  deletePageKeys(guids: string[]): Promise<void>;
}

// No-op index that does nothing (used when no index is configured)
const noOpIndex: PageIndexProvider = {
  getPageKey: async () => null,
  putPageKey: async () => {},
  deletePageKey: async () => {},
  deletePageKeys: async () => {},
};

/**
 * Derive the .md file key from a page folder path.
 * "parent/child/" + guid → "parent/child/child.md"
 */
function folderToFileKey(folder: string, guid: string): string {
  return `${folder}${guid}.md`;
}
import {
  PageContent,
  PageProperty,
  Version,
  PageSummary,
  AttachmentUploadInput,
  AttachmentUploadResult,
  AttachmentMetadata,
} from '../types/index.js';

interface S3StorageConfig {
  type?: 's3';
  bucketName: string;
  region?: string;
  endpoint?: string; // For LocalStack
  pageIndex?: PageIndexProvider; // Optional page index for GUID → S3 key lookups
}

export class S3StoragePlugin extends BaseStoragePlugin {
  private s3Client: S3Client;
  private bucketName: string;
  private pageIndex: PageIndexProvider;
  private repairingGuids: Set<string> = new Set();

  constructor(config: S3StorageConfig) {
    super('s3');

    this.bucketName = config.bucketName;
    this.pageIndex = config.pageIndex || noOpIndex;
    
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      ...(config.endpoint && {
        endpoint: config.endpoint,
        forcePathStyle: true, // Required for LocalStack
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
      }),
    });

    // Note: No in-memory caching implemented for Lambda architecture
    // Rationale: Lambda containers are ephemeral and recycled after ~15-45min inactivity.
    // For a low-traffic family wiki, most requests would hit cold starts, making cache ineffective.
    // S3 provides sub-10ms latency which is sufficient for our use case (3-20 users).
    // If caching is needed in the future, use DynamoDB or ElastiCache for shared persistent state.
  }

  /**
   * Build S3 key path for a page
   * Every page is stored in its own folder: {guid}/{guid}.md
   * Child pages: {parent-guid}/{child-guid}/{child-guid}.md
   * Multi-level: {grandparent-guid}/{parent-guid}/{child-guid}/{child-guid}.md
   * 
   * This provides a consistent structure where:
   * - Each page has its own folder (for future attachments/assets)
   * - The folder hierarchy reflects the page hierarchy
   * - The page content is always at {guid}/{guid}.md within its folder
   */
  private async buildPageKey(guid: string, parentGuid: string | null): Promise<string> {
    if (parentGuid === null || parentGuid === '') {
      return `${guid}/${guid}.md`;
    }
    
    // Build full ancestor path for proper nesting
    const ancestorPath = await this.buildAncestorPath(parentGuid);
    return `${ancestorPath}${guid}/${guid}.md`;
  }

  /**
   * Build the full ancestor path for a page
   * Returns path with trailing slash, e.g., "grandparent/parent/"
   */
  private async buildAncestorPath(guid: string): Promise<string> {
    try {
      const page = await this.loadPage(guid);
      
      if (!page.folderId || page.folderId === '') {
        // This is a root page
        return `${guid}/`;
      }
      
      // Recursively build path for parent
      const parentPath = await this.buildAncestorPath(page.folderId);
      return `${parentPath}${guid}/`;
    } catch (error) {
      // If we can't load the parent, treat current as root
      return `${guid}/`;
    }
  }

  /**
   * Build the directory path where a page's attachments are stored
   * Returns path like: {parent-guid}/{guid}/_attachments/
   * For root pages: {guid}/_attachments/
   * This ensures attachments are in the same folder as the page's .md file
   */
  private async buildAttachmentPath(pageGuid: string): Promise<string> {
    // Always derive from the actual page folder in S3 so malformed frontmatter
    // (for example folderId = pageGuid) cannot produce duplicated segments.
    const folder = await this.findPageFolder(pageGuid);
    if (!folder) {
      throw this.createError(
        `Page not found: ${pageGuid}`,
        'PAGE_NOT_FOUND',
        404
      );
    }

    return `${folder}_attachments/`;
  }

  private inferParentGuidFromFolder(folder: string, pageGuid: string): string {
    // Folder format: "grandparent/parent/child/" — segments are ancestor GUIDs
    const segments = folder.split('/').filter(Boolean);
    if (segments.length < 2) {
      return '';
    }

    // Last segment is the page's own guid, parent is the one before it
    let parentIndex = segments.length - 2;

    while (parentIndex >= 0 && segments[parentIndex] === pageGuid) {
      parentIndex -= 1;
    }

    return parentIndex >= 0 ? segments[parentIndex] : '';
  }



  /**
   * Parse YAML frontmatter from markdown content
   */
  private parseFrontmatter(rawContent: string): { metadata: Record<string, string | string[] | undefined>; body: string; properties?: Record<string, PageProperty> } {
    // Normalize Windows CRLF to LF so regex matching works regardless of line endings
    const content = rawContent.replace(/\r\n/g, '\n');
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      throw this.createError(
        'Invalid page format: missing YAML frontmatter',
        'INVALID_FORMAT',
        400
      );
    }

    const yamlContent = match[1];
    const body = match[2];

    // Simple YAML parser (supports basic key: value format, arrays, and properties block)
    const metadata: Record<string, string | string[] | undefined> = {};
    const lines = yamlContent.split('\n');
    let currentKey: string | null = null;
    let currentArray: string[] = [];
    let inProperties = false;
    let currentPropName: string | null = null;
    let currentProp: Partial<PageProperty> = {};
    const properties: Record<string, PageProperty> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.length - line.trimStart().length;

      // Detect entering/leaving the properties block
      if (indent === 0 && line.trimStart().startsWith('properties:')) {
        const value = line.substring(line.indexOf(':') + 1).trim();
        if (value === '{}' || value === '') {
          inProperties = true;
          // Flush any pending top-level array
          if (currentKey && currentArray.length > 0) {
            metadata[currentKey] = currentArray;
            currentKey = null;
            currentArray = [];
          }
          continue;
        }
      }

      if (inProperties) {
        // A non-indented line means we left the properties block
        if (indent === 0 && line.trim() !== '') {
          // Save pending property
          if (currentPropName && currentProp.type) {
            properties[currentPropName] = currentProp as PageProperty;
          }
          inProperties = false;
          currentPropName = null;
          currentProp = {};
          // Fall through to normal parsing for this line
        } else {
          // Parse property entries (indent 2 = property name, indent 4 = type/value)
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (indent === 2 && trimmed.includes(':')) {
            // Save previous property
            if (currentPropName && currentProp.type) {
              properties[currentPropName] = currentProp as PageProperty;
            }
            const propName = trimmed.substring(0, trimmed.indexOf(':')).trim();
            currentPropName = propName;
            currentProp = {};
          } else if (indent >= 4 && trimmed.includes(':')) {
            const key = trimmed.substring(0, trimmed.indexOf(':')).trim();
            let val = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            // Remove quotes
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            if (key === 'type') {
              currentProp.type = val as PageProperty['type'];
            } else if (key === 'value') {
              if (val.startsWith('[') && val.endsWith(']')) {
                // Inline array
                currentProp.value = val.substring(1, val.length - 1)
                  .split(',')
                  .map(item => item.trim().replace(/^["']|["']$/g, ''))
                  .filter(item => item.length > 0);
              } else if (currentProp.type === 'number') {
                currentProp.value = parseFloat(val) || 0;
              } else if (val === '' || val === '[]') {
                // Multi-line array values follow on subsequent lines
                currentProp.value = [];
              } else {
                currentProp.value = val;
              }
            }
          } else if (indent >= 6 && trimmed.startsWith('-') && Array.isArray(currentProp.value)) {
            // Multi-line array item for a property value
            const item = trimmed.substring(1).trim().replace(/^["']|["']$/g, '');
            (currentProp.value as string[]).push(item);
          }
          continue;
        }
      }

      // Check if this is an array item (starts with -)
      if (line.trim().startsWith('-') && currentKey) {
        const item = line.trim().substring(1).trim();
        currentArray.push(item);
        continue;
      }

      // If we were building an array, save it now
      if (currentKey && currentArray.length > 0) {
        metadata[currentKey] = currentArray;
        currentKey = null;
        currentArray = [];
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }

      // Parse arrays (inline format: ["item1", "item2"] or empty value for multi-line)
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.substring(1, value.length - 1);
        metadata[key] = arrayContent
          .split(',')
          .map(item => item.trim().replace(/^["']|["']$/g, ''))
          .filter(item => item.length > 0);
      } else if (value === '' || value === '[]') {
        // Empty value might indicate multi-line array starting on next line
        currentKey = key;
        currentArray = [];
      } else {
        metadata[key] = value;
      }
    }

    // Save any remaining array
    if (currentKey && currentArray.length > 0) {
      metadata[currentKey] = currentArray;
    }

    // Save any remaining property
    if (inProperties && currentPropName && currentProp.type) {
      properties[currentPropName] = currentProp as PageProperty;
    }

    const hasProperties = Object.keys(properties).length > 0;
    return { metadata, body, ...(hasProperties ? { properties } : {}) };
  }

  /**
   * Serialize page content to markdown with YAML frontmatter
   */
  private serializeToMarkdown(content: PageContent): string {
    const lines = [
      '---',
      `title: "${content.title}"`,
      `guid: "${content.guid}"`,
    ];
    
    // Add parentGuid and folderId if present
    if (content.folderId) {
      lines.push(`parentGuid: "${content.folderId}"`);
      lines.push(`folderId: "${content.folderId}"`);
    }
    
    lines.push(`status: "${content.status}"`);

    // Add sortOrder if present
    if (content.sortOrder !== undefined) {
      lines.push(`sortOrder: ${content.sortOrder}`);
    }

    // Add description if present
    if (content.description) {
      lines.push(`description: "${content.description}"`);
    }

    // Add pageType if present
    if (content.pageType) {
      lines.push(`pageType: "${content.pageType}"`);
    }

    // Add boardConfig if present (stored as single-line JSON)
    if (content.boardConfig) {
      lines.push(`boardConfig: '${JSON.stringify(content.boardConfig)}'`);
    }
    
    // Add tags in YAML list format
    if (content.tags.length > 0) {
      lines.push('tags:');
      content.tags.forEach(tag => {
        lines.push(`  - ${tag}`);
      });
    } else {
      lines.push('tags: []');
    }
    
    // Add properties block if present and non-empty
    if (content.properties && Object.keys(content.properties).length > 0) {
      lines.push('properties:');
      for (const [name, prop] of Object.entries(content.properties)) {
        lines.push(`  ${name}:`);
        lines.push(`    type: ${prop.type}`);
        if (Array.isArray(prop.value)) {
          if (prop.value.length === 0) {
            lines.push('    value: []');
          } else {
            lines.push(`    value: [${prop.value.map(v => `"${v}"`).join(', ')}]`);
          }
        } else if (typeof prop.value === 'number') {
          lines.push(`    value: ${prop.value}`);
        } else {
          lines.push(`    value: "${prop.value}"`);
        }
      }
    }

    lines.push(
      `createdBy: "${content.createdBy}"`,
      `modifiedBy: "${content.modifiedBy}"`,
      `createdAt: "${content.createdAt}"`,
      `modifiedAt: "${content.modifiedAt}"`,
      '---'
    );

    return lines.join('\n') + '\n' + content.content;
  }

  /**
   * Save a page to S3
   */
  async savePage(
    guid: string,
    parentGuid: string | null,
    content: PageContent
  ): Promise<void> {
    try {
      // Validate content
      this.validatePageContent(content);

      // Ensure timestamps are set
      if (!content.createdAt) {
        content.createdAt = this.formatDate();
      }
      content.modifiedAt = this.formatDate();

      // Ensure folderId matches parentGuid
      content.folderId = parentGuid || '';

      // Build S3 key
      const key = await this.buildPageKey(guid, parentGuid);

      // Serialize to markdown with frontmatter
      const markdown = this.serializeToMarkdown(content);

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: markdown,
        ContentType: 'text/markdown',
        Metadata: {
          guid: guid,
          title: content.title,
          status: content.status,
        },
      });

      await this.s3Client.send(command);

      // Update the page index with the folder path (fire-and-forget — don't block the save)
      const folder = key.substring(0, key.lastIndexOf('/') + 1);
      this.pageIndex.putPageKey({
        guid,
        s3Key: folder,
        parentGuid: parentGuid || null,
        title: content.title,
        updatedAt: content.modifiedAt || new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && error.code.startsWith('INVALID_')) {
        throw err; // Re-throw validation errors
      }
      throw this.createError(
        `Failed to save page: ${error.message}`,
        'SAVE_FAILED',
        500
      );
    }
  }

  /**
   * Load a page from S3
   * 
   * Note: This requires knowing the full path. For now, we'll search
   * for the page by GUID across all possible locations.
   */
  async loadPage(guid: string): Promise<PageContent> {
    try {
      // Validate GUID
      if (!this.validateGuid(guid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Try to find the page folder
      const folder = await this.findPageFolder(guid);

      if (!folder) {
        throw this.createError(
          `Page not found: ${guid}`,
          'PAGE_NOT_FOUND',
          404
        );
      }

      // Fetch from S3
      const fileKey = folderToFileKey(folder, guid);
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw this.createError(
          'Empty response from S3',
          'EMPTY_RESPONSE',
          500
        );
      }

      // Read stream to string
      const markdown = await this.readBodyAsString(response.Body);

      // Parse frontmatter
      const { metadata, body, properties } = this.parseFrontmatter(markdown);

      // Build PageContent object
      const folderId = Array.isArray(metadata.folderId) ? metadata.folderId[0] : metadata.folderId;
      const parentGuid = Array.isArray(metadata.parentGuid) ? metadata.parentGuid[0] : metadata.parentGuid;
      const effectiveFolderId = folderId || parentGuid || '';
      const pageGuid = Array.isArray(metadata.guid) ? metadata.guid[0] : metadata.guid || guid;
      const inferredParentGuid = this.inferParentGuidFromFolder(folder, pageGuid);
      const normalizedFolderId =
        (effectiveFolderId === null || effectiveFolderId === 'null')
          ? ''
          : (effectiveFolderId === pageGuid ? inferredParentGuid : effectiveFolderId);

      // Parse sortOrder if present
      const rawSortOrder = Array.isArray(metadata.sortOrder) ? metadata.sortOrder[0] : metadata.sortOrder;
      const parsedSortOrder = rawSortOrder !== undefined ? parseInt(rawSortOrder, 10) : undefined;
      const sortOrder = parsedSortOrder !== undefined && !isNaN(parsedSortOrder) ? parsedSortOrder : undefined;

      const pageContent: PageContent = {
        guid: pageGuid,
        title: Array.isArray(metadata.title) ? metadata.title[0] : metadata.title || 'Untitled',
        content: body,
        folderId: normalizedFolderId,
        tags: Array.isArray(metadata.tags) ? metadata.tags : metadata.tags ? [metadata.tags] : [],
        status: (Array.isArray(metadata.status) ? metadata.status[0] : metadata.status || 'draft') as 'draft' | 'published' | 'archived' | 'deleted',
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        description: Array.isArray(metadata.description) ? metadata.description[0] : metadata.description,
        ...(metadata.pageType ? { pageType: Array.isArray(metadata.pageType) ? metadata.pageType[0] : metadata.pageType } : {}),
        ...(properties ? { properties } : {}),
        ...(metadata.boardConfig ? (() => {
          try {
            const raw = Array.isArray(metadata.boardConfig) ? metadata.boardConfig[0] : metadata.boardConfig;
            return { boardConfig: JSON.parse(raw) };
          } catch { return {}; }
        })() : {}),
        createdBy: Array.isArray(metadata.createdBy) ? metadata.createdBy[0] : metadata.createdBy || '',
        modifiedBy: Array.isArray(metadata.modifiedBy) ? metadata.modifiedBy[0] : metadata.modifiedBy || '',
        createdAt: Array.isArray(metadata.createdAt) ? metadata.createdAt[0] : metadata.createdAt || this.formatDate(),
        modifiedAt: Array.isArray(metadata.modifiedAt) ? metadata.modifiedAt[0] : metadata.modifiedAt || this.formatDate(),
      };

      return pageContent;
    } catch (err: unknown) {
      const error = err as { code?: string; name?: string; message?: string };
      if (error.code && (error.code === 'PAGE_NOT_FOUND' || error.code === 'INVALID_GUID')) {
        throw err;
      }
      
      if (error.name === 'NoSuchKey') {
        throw this.createError(
          `Page not found: ${guid}`,
          'PAGE_NOT_FOUND',
          404
        );
      }

      throw this.createError(
        `Failed to load page: ${error.message}`,
        'LOAD_FAILED',
        500,
        { errorCode: error.code || '', errorName: error.name || '', errorMessage: error.message || '' }
      );
    }
  }

  /**
   * Find a page's folder path in S3 by its GUID.
   * Returns the folder path (e.g., "parent-guid/child-guid/"), not the .md file key.
   * Use folderToFileKey() to derive the .md path when needed.
   */
  private async findPageFolder(guid: string): Promise<string | null> {
    try {
      // 1. Try the DynamoDB page index first — O(1) lookup
      try {
        const indexedFolder = await this.pageIndex.getPageKey(guid);
        if (indexedFolder) {
          return indexedFolder;
        }
      } catch {
        // Index unavailable — fall through to S3 scan
        console.warn(`[PageIndex] Index lookup failed for ${guid}, falling back to S3 scan`);
      }

      // 2. Fallback: try as a root page (HeadObject — fast)
      const rootFolder = `${guid}/`;
      try {
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: folderToFileKey(rootFolder, guid),
        }));
        // Repair the index with this folder
        this.repairIndex(guid, rootFolder);
        return rootFolder;
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        if (error.name !== 'NotFound') {
          throw err;
        }
      }

      // 3. Fallback: full bucket scan — O(n), slow
      let continuationToken: string | undefined = undefined;

      do {
        const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          ContinuationToken: continuationToken,
        });

        const response: ListObjectsV2CommandOutput = await this.s3Client.send(listCommand);

        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key && obj.Key.endsWith(`/${guid}/${guid}.md`)) {
              // Extract folder from the discovered .md key
              const folder = obj.Key.substring(0, obj.Key.lastIndexOf('/') + 1);
              this.repairIndex(guid, folder);
              return folder;
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return null;
    } catch (err: unknown) {
      const error = err as { message?: string };
      throw this.createError(
        `Failed to find page: ${error.message}`,
        'SEARCH_FAILED',
        500
      );
    }
  }

  /**
   * Repair a missing or stale index entry (fire-and-forget).
   * Called when findPageFolder falls back to S3 scan and finds the page.
   */
  private repairIndex(guid: string, s3Folder: string): void {
    // Guard against infinite recursion: loadPage → findPageFolder → repairIndex → loadPage
    if (this.repairingGuids.has(guid)) return;
    this.repairingGuids.add(guid);

    // Load the page to get metadata for the index entry, but don't block on it
    this.loadPage(guid).then(page => {
      this.pageIndex.putPageKey({
        guid,
        s3Key: s3Folder,
        parentGuid: page.folderId || null,
        title: page.title,
        updatedAt: page.modifiedAt || new Date().toISOString(),
      });
    }).catch(() => {
      // Best-effort repair — if it fails, the next request will try again
    }).finally(() => {
      this.repairingGuids.delete(guid);
    });
  }

  /**
   * Delete a page from S3
   */
  async deletePage(guid: string, recursive: boolean = false): Promise<void> {
    try {
      // Validate GUID
      if (!this.validateGuid(guid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Find the page folder
      const folder = await this.findPageFolder(guid);

      if (!folder) {
        throw this.createError(
          `Page not found: ${guid}`,
          'PAGE_NOT_FOUND',
          404
        );
      }

      // Check for children
      const hasChildPages = await this.hasChildren(guid);

      if (hasChildPages && !recursive) {
        throw this.createError(
          'This page has child pages. Please delete or move the child pages first.',
          'HAS_CHILDREN',
          400
        );
      }

      if (recursive && hasChildPages) {
        // Collect child GUIDs for index cleanup before deleting
        const children = await this.listChildren(guid);
        const childGuids = await this.collectDescendantGuids(children);

        // Delete all children recursively from S3
        await this.deletePageAndChildren(guid, folderToFileKey(folder, guid));

        // Clean up index for deleted page and all descendants
        this.pageIndex.deletePageKeys([guid, ...childGuids]);
      } else {
        // Delete single page
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: folderToFileKey(folder, guid),
        });
        await this.s3Client.send(deleteCommand);

        // Clean up index for deleted page
        this.pageIndex.deletePageKey(guid);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && ['INVALID_GUID', 'PAGE_NOT_FOUND', 'HAS_CHILDREN'].includes(error.code)) {
        throw err;
      }
      throw this.createError(
        `Failed to delete page: ${error.message}`,
        'DELETE_FAILED',
        500
      );
    }
  }

  /**
   * Collect GUIDs from a list of page summaries and their descendants (for index cleanup on recursive delete).
   */
  private async collectDescendantGuids(children: PageSummary[]): Promise<string[]> {
    const guids: string[] = [];
    for (const child of children) {
      guids.push(child.guid);
      if (child.hasChildren) {
        const grandchildren = await this.listChildren(child.guid);
        guids.push(...await this.collectDescendantGuids(grandchildren));
      }
    }
    return guids;
  }

  /**
   * Delete a page and all its children recursively
   */
  private async deletePageAndChildren(guid: string, pageKey: string): Promise<void> {
    const objectsToDelete: { Key: string }[] = [];

    // Add the page itself
    objectsToDelete.push({ Key: pageKey });

    // Find all children (files in the guid/ folder)
    const prefix = `${guid}/`;
    let continuationToken: string | undefined = undefined;

    do {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response: ListObjectsV2CommandOutput = await this.s3Client.send(listCommand);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            objectsToDelete.push({ Key: obj.Key });
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Delete all objects in batches (S3 limit is 1000 per request)
    const batchSize = 1000;
    for (let i = 0; i < objectsToDelete.length; i += batchSize) {
      const batch = objectsToDelete.slice(i, i + batchSize);
      
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: batch,
          Quiet: true,
        },
      });

      await this.s3Client.send(deleteCommand);
    }
  }

  /**
   * List all versions of a page
   */
  async listVersions(guid: string): Promise<Version[]> {
    try {
      // Validate GUID
      if (!this.validateGuid(guid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Find the page folder
      const folder = await this.findPageFolder(guid);

      if (!folder) {
        throw this.createError(
          `Page not found: ${guid}`,
          'PAGE_NOT_FOUND',
          404
        );
      }

      // List object versions
      const fileKey = folderToFileKey(folder, guid);
      const command = new ListObjectVersionsCommand({
        Bucket: this.bucketName,
        Prefix: fileKey,
      });

      const response = await this.s3Client.send(command);

      if (!response.Versions || response.Versions.length === 0) {
        return [];
      }

      // Convert to Version objects
      const versions: Version[] = response.Versions
        .filter(v => v.Key === fileKey) // Only exact matches
        .map(v => ({
          versionId: v.VersionId || '',
          timestamp: v.LastModified ? v.LastModified.toISOString() : this.formatDate(),
          modifiedBy: '', // Would need to fetch from metadata or object tags
          size: v.Size || 0,
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return versions;
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && ['INVALID_GUID', 'PAGE_NOT_FOUND'].includes(error.code)) {
        throw err;
      }
      throw this.createError(
        `Failed to list versions: ${error.message}`,
        'LIST_VERSIONS_FAILED',
        500
      );
    }
  }

  /**
   * Check if a page has children (non-recursive S3 check)
   * In new structure, children are at {ancestor-path}/{guid}/{child-guid}/{child-guid}.md
   * Need to find where the page is located first, then check for child folders
   */
  private async hasChildrenDirect(guid: string): Promise<boolean> {
    try {
      // Find the page's folder
      const pageFolder = await this.findPageFolder(guid);
      if (!pageFolder) {
        return false;
      }
      
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: pageFolder,
        Delimiter: '/', // Get folders only
      });

      const response = await this.s3Client.send(listCommand);
      // Check for CommonPrefixes (child folders)
      if (response.CommonPrefixes && response.CommonPrefixes.length > 0) {
        // Any folder other than the page's own folder indicates children
        // The page's own .md file is in the same folder, so child folders = children
        const childFolders = response.CommonPrefixes.filter(p => {
          const pathParts = p.Prefix?.split('/').filter(part => part.length > 0) || [];
          const folderGuid = pathParts[pathParts.length - 1];
          return folderGuid !== guid && folderGuid !== '_attachments';
        });
        return childFolders.length > 0;
      }
      return false;
    } catch (error) {
      // If listing fails, assume no children
      return false;
    }
  }

  /**
   * List all child pages of a parent (or root-level pages)
   */
  async listChildren(parentGuid: string | null): Promise<PageSummary[]> {
    try {
      const children: PageSummary[] = [];

      if (parentGuid === null) {
        // List root-level pages (folders at bucket root)
        // In new structure: {guid}/{guid}.md
        let continuationToken: string | undefined = undefined;

        do {
          const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Delimiter: '/',
            ContinuationToken: continuationToken,
          });

          const response: ListObjectsV2CommandOutput = await this.s3Client.send(listCommand);

          // Get root folders (CommonPrefixes)
          if (response.CommonPrefixes) {
            for (const prefix of response.CommonPrefixes) {
              if (prefix.Prefix) {
                // Extract GUID from folder name (remove trailing /)
                const guid = prefix.Prefix.replace(/\/$/, '');
                try {
                  const page = await this.loadPage(guid);
                  // Only include pages that are actually root pages (folderId is null or empty)
                  if (!page.folderId || page.folderId === '') {
                    children.push({
                      guid: page.guid,
                      title: page.title,
                      parentGuid: null,
                      status: page.status === 'deleted' ? 'archived' : page.status,
                      ...(page.sortOrder !== undefined ? { sortOrder: page.sortOrder } : {}),
                      createdBy: page.createdBy,
                      modifiedAt: page.modifiedAt,
                      modifiedBy: page.modifiedBy,
                      hasChildren: await this.hasChildrenDirect(guid),
                      ...(page.pageType ? { pageType: page.pageType } : {}),
                    });
                  }
                } catch (err) {
                  // Skip pages that can't be loaded
                  console.warn(`Failed to load page ${guid}:`, err);
                }
              }
            }
          }

          continuationToken = response.NextContinuationToken;
        } while (continuationToken);
      } else {
        // List children in the parent's folder
        // In new structure: need to find where parent is located first
        // Then list its immediate child folders
        
        // First, find the parent's folder
        const parentFolder = await this.findPageFolder(parentGuid);
        if (!parentFolder) {
          // Parent not found, return empty
          return [];
        }

        console.log(`[listChildren] Parent: ${parentGuid}, ParentFolder: ${parentFolder}`);
        
        let continuationToken: string | undefined = undefined;

        do {
          const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: parentFolder,
            Delimiter: '/',
            ContinuationToken: continuationToken,
          });

          const response: ListObjectsV2CommandOutput = await this.s3Client.send(listCommand);

          console.log(`[listChildren] CommonPrefixes:`, response.CommonPrefixes?.map(p => p.Prefix));
          console.log(`[listChildren] Contents:`, response.Contents?.map(c => c.Key));

          // Get child folders (CommonPrefixes)
          if (response.CommonPrefixes) {
            for (const childPrefix of response.CommonPrefixes) {
              if (childPrefix.Prefix) {
                // Extract child GUID from folder path
                // Format: {ancestor-path}/{parentGuid}/{childGuid}/
                const pathParts = childPrefix.Prefix.split('/');
                const guid = pathParts[pathParts.length - 2]; // Second to last part (before trailing /)
                
                console.log(`[listChildren] Processing child prefix: ${childPrefix.Prefix}, extracted guid: ${guid}, parentGuid: ${parentGuid}`);
                
                // Skip the parent's own guid folder (the .md file is in its own folder)
                if (guid === parentGuid) continue;

                try {
                  const page = await this.loadPage(guid);
                  children.push({
                    guid: page.guid,
                    title: page.title,
                    parentGuid: parentGuid,
                    status: page.status === 'deleted' ? 'archived' : page.status,
                    ...(page.sortOrder !== undefined ? { sortOrder: page.sortOrder } : {}),
                    createdBy: page.createdBy,
                    modifiedAt: page.modifiedAt,
                    modifiedBy: page.modifiedBy,
                    hasChildren: await this.hasChildrenDirect(guid),
                    ...(page.pageType ? { pageType: page.pageType } : {}),
                  });
                } catch (err) {
                  console.warn(`Failed to load page ${guid}:`, err);
                }
              }
            }
          }

          continuationToken = response.NextContinuationToken;
        } while (continuationToken);
      }

      // Sort by sortOrder (ascending), then by title for ties/unordered pages
      // Pages without sortOrder sort after all ordered pages
      children.sort((a, b) => {
        const aHasOrder = a.sortOrder !== undefined;
        const bHasOrder = b.sortOrder !== undefined;
        if (aHasOrder && bHasOrder) return a.sortOrder! - b.sortOrder!;
        if (aHasOrder && !bHasOrder) return -1;
        if (!aHasOrder && bHasOrder) return 1;
        return a.title.localeCompare(b.title);
      });

      return children;
    } catch (err: unknown) {
      const error = err as { message?: string };
      throw this.createError(
        `Failed to list children: ${error.message}`,
        'LIST_CHILDREN_FAILED',
        500
      );
    }
  }

  /**
   * Move a page to a new parent
   */
  async movePage(guid: string, newParentGuid: string | null): Promise<void> {
    try {
      // Validate GUIDs
      if (!this.validateGuid(guid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      if (newParentGuid && !this.validateGuid(newParentGuid)) {
        throw this.createError('Invalid parent GUID format', 'INVALID_GUID', 400);
      }

      // Check for circular reference
      await this.validateNoCircularReference(guid, newParentGuid);

      // Load current page
      const page = await this.loadPage(guid);
      const oldFolder = await this.findPageFolder(guid);

      if (!oldFolder) {
        throw this.createError(
          `Page not found: ${guid}`,
          'PAGE_NOT_FOUND',
          404
        );
      }

      // Build new key
      const newKey = await this.buildPageKey(guid, newParentGuid);
      const oldKey = folderToFileKey(oldFolder, guid);

      // If keys are the same, nothing to do
      if (oldKey === newKey) {
        return;
      }

      // Update page metadata
      page.folderId = newParentGuid || '';
      page.modifiedAt = this.formatDate();

      // Copy to new location
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${oldKey}`,
        Key: newKey,
        ContentType: 'text/markdown',
        Metadata: {
          guid: guid,
          title: page.title,
          status: page.status,
        },
        MetadataDirective: 'REPLACE',
      });

      await this.s3Client.send(copyCommand);

      // Update content with new parent
      await this.savePage(guid, newParentGuid, page);

      // Delete old location
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: oldKey,
      });
      await this.s3Client.send(deleteCommand);

      // Move children if any
      const children = await this.listChildren(guid);
      for (const child of children) {
        const childOldFolder = await this.findPageFolder(child.guid);
        if (childOldFolder) {
          // Copy child to new location
          const childOldKey = folderToFileKey(childOldFolder, child.guid);
          const childNewKey = await this.buildPageKey(child.guid, guid);
          const childNewFolder = childNewKey.substring(0, childNewKey.lastIndexOf('/') + 1);

          const childCopyCommand = new CopyObjectCommand({
            Bucket: this.bucketName,
            CopySource: `${this.bucketName}/${childOldKey}`,
            Key: childNewKey,
            ContentType: 'text/markdown',
            MetadataDirective: 'COPY',
          });

          await this.s3Client.send(childCopyCommand);

          // Delete old child location
          const childDeleteCommand = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: childOldKey,
          });
          await this.s3Client.send(childDeleteCommand);

          // Update child index entry with new folder
          this.pageIndex.putPageKey({
            guid: child.guid,
            s3Key: childNewFolder,
            parentGuid: guid,
            title: child.title,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && ['INVALID_GUID', 'PAGE_NOT_FOUND', 'CIRCULAR_REFERENCE'].includes(error.code)) {
        throw err;
      }
      throw this.createError(
        `Failed to move page: ${error.message}`,
        'MOVE_FAILED',
        500
      );
    }
  }

  /**
   * Upload attachment to page-specific attachments folder
   * Path: {parent-guid}/{pageGuid}/_attachments/{sanitizedFilename}
   * For root pages: {pageGuid}/_attachments/{sanitizedFilename}
   */
  async uploadAttachment(pageGuid: string, file: AttachmentUploadInput): Promise<AttachmentUploadResult> {
    try {
      if (!this.validateGuid(pageGuid)) {
        throw this.createError('Invalid page GUID format', 'INVALID_GUID', 400);
      }

      // Get attachment path (same folder as .md file)
      const attachmentPath = await this.buildAttachmentPath(pageGuid);

      // Sanitize filename to make it safe for S3 storage
      const sanitizedFilename = this.sanitizeFilename(file.originalFilename);
      const attachmentKey = `${attachmentPath}${sanitizedFilename}`;

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: attachmentKey,
        Body: file.data,
        ContentType: file.contentType,
        Metadata: {
          filename: encodeURIComponent(sanitizedFilename),
          uploadedby: file.uploadedBy,
        },
      }));

      return {
        filename: sanitizedFilename,
        attachmentKey,
        contentType: file.contentType,
        size: file.data.length,
      };
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && ['INVALID_GUID', 'PAGE_NOT_FOUND'].includes(error.code)) {
        throw err;
      }

      throw this.createError(
        `Failed to upload attachment: ${error.message}`,
        'ATTACHMENT_UPLOAD_FAILED',
        500
      );
    }
  }

  /**
   * Delete an attachment file from page attachments folder
   */
  async deleteAttachment(pageGuid: string, filename: string): Promise<void> {
    try {
      if (!this.validateGuid(pageGuid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Get attachment path (same folder as .md file)
      const attachmentPath = await this.buildAttachmentPath(pageGuid);

      const sanitizedFilename = this.sanitizeFilename(filename);
      const attachmentKey = `${attachmentPath}${sanitizedFilename}`;
      const metadataKey = `${attachmentPath}${sanitizedFilename}.meta.json`;

      await this.s3Client.send(new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: [
            { Key: attachmentKey },
            { Key: metadataKey },
          ],
          Quiet: true,
        },
      }));
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && ['INVALID_GUID', 'ATTACHMENT_NOT_FOUND'].includes(error.code)) {
        throw err;
      }

      throw this.createError(
        `Failed to delete attachment: ${error.message}`,
        'ATTACHMENT_DELETE_FAILED',
        500
      );
    }
  }

  /**
   * Save attachment metadata sidecar JSON
   * Path: {parent-guid}/{pageGuid}/_attachments/{filename}.meta.json
   * For root pages: {pageGuid}/_attachments/{filename}.meta.json
   */
  async saveAttachmentMetadata(
    pageGuid: string,
    filename: string,
    metadata: AttachmentMetadata
  ): Promise<void> {
    try {
      if (!this.validateGuid(pageGuid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Get attachment path (same folder as .md file)
      const attachmentPath = await this.buildAttachmentPath(pageGuid);

      const sanitizedFilename = this.sanitizeFilename(filename);
      const metadataKey = `${attachmentPath}${sanitizedFilename}.meta.json`;

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: metadataKey,
        Body: JSON.stringify(metadata),
        ContentType: 'application/json',
      }));
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'INVALID_GUID') {
        throw err;
      }

      throw this.createError(
        `Failed to save attachment metadata: ${error.message}`,
        'ATTACHMENT_METADATA_SAVE_FAILED',
        500
      );
    }
  }

  /**
   * Get sidecar metadata JSON for an attachment
   */
  async getAttachmentMetadata(pageGuid: string, filename: string): Promise<AttachmentMetadata> {
    try {
      if (!this.validateGuid(pageGuid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Get attachment path (same folder as .md file)
      const attachmentPath = await this.buildAttachmentPath(pageGuid);

      const sanitizedFilename = this.sanitizeFilename(filename);
      const metadataKey = `${attachmentPath}${sanitizedFilename}.meta.json`;
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: metadataKey,
      }));

      const metadataBody = await this.readBodyAsString(response.Body);
      const metadata = JSON.parse(metadataBody) as AttachmentMetadata;
      return metadata;
    } catch (err: unknown) {
      const error = err as { code?: string; name?: string; message?: string };

      if (error.code === 'INVALID_GUID') {
        throw err;
      }

      if (error.name === 'NoSuchKey') {
        throw this.createError(
          `Attachment metadata not found: ${filename}`,
          'ATTACHMENT_METADATA_NOT_FOUND',
          404
        );
      }

      throw this.createError(
        `Failed to load attachment metadata: ${error.message}`,
        'ATTACHMENT_METADATA_LOAD_FAILED',
        500
      );
    }
  }

  /**
   * List attachments for a page (newest first)
   */
  async listAttachments(pageGuid: string): Promise<AttachmentMetadata[]> {
    try {
      if (!this.validateGuid(pageGuid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Get attachment path (same folder as .md file)
      const prefix = await this.buildAttachmentPath(pageGuid);
      const response = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: 1000,
      }));

      const metadataKeys = (response.Contents || [])
        .map(item => item.Key)
        .filter((key): key is string => Boolean(key))
        .filter(key => key.endsWith('.meta.json'));

      if (metadataKeys.length === 0) {
        return [];
      }

      const metadataEntries = await Promise.all(
        metadataKeys.map(async (metadataKey) => {
          try {
            const getResult = await this.s3Client.send(new GetObjectCommand({
              Bucket: this.bucketName,
              Key: metadataKey,
            }));
            const metadataBody = await this.readBodyAsString(getResult.Body);
            return JSON.parse(metadataBody) as AttachmentMetadata;
          } catch (err: unknown) {
            const error = err as { message?: string };
            console.warn(`Skipping invalid attachment metadata at ${metadataKey}: ${error.message}`);
            return null;
          }
        })
      );

      return metadataEntries
        .filter((entry): entry is AttachmentMetadata => entry !== null)
        .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt));
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && ['INVALID_GUID', 'PAGE_NOT_FOUND'].includes(error.code)) {
        throw err;
      }

      throw this.createError(
        `Failed to list attachments: ${error.message}`,
        'ATTACHMENT_LIST_FAILED',
        500
      );
    }
  }

  /**
   * Generate temporary download URL for an attachment
   */
  async getAttachmentUrl(pageGuid: string, filename: string): Promise<string> {
    try {
      if (!this.validateGuid(pageGuid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Get attachment path (same folder as .md file)
      const attachmentPath = await this.buildAttachmentPath(pageGuid);

      const sanitizedFilename = this.sanitizeFilename(filename);
      const attachmentKey = `${attachmentPath}${sanitizedFilename}`;

      // Check if attachment exists
      try {
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: attachmentKey,
        }));
      } catch (headError: unknown) {
        const error = headError as { name?: string };
        if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
          throw this.createError('Attachment not found', 'ATTACHMENT_NOT_FOUND', 404);
        }
        throw headError;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: attachmentKey,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && ['INVALID_GUID', 'ATTACHMENT_NOT_FOUND'].includes(error.code)) {
        throw err;
      }

      throw this.createError(
        `Failed to generate attachment URL: ${error.message}`,
        'ATTACHMENT_URL_FAILED',
        500
      );
    }
  }

  /**
   * Generate a presigned PUT URL for direct-to-S3 attachment upload.
   * Returns the presigned URL and the final S3 key so the caller can
   * confirm the upload and save metadata afterwards.
   */
  async getAttachmentUploadUrl(
    pageGuid: string,
    filename: string,
    contentType: string,
    maxContentLength: number
  ): Promise<{ uploadUrl: string; attachmentKey: string }> {
    try {
      if (!this.validateGuid(pageGuid)) {
        throw this.createError('Invalid page GUID format', 'INVALID_GUID', 400);
      }

      const attachmentPath = await this.buildAttachmentPath(pageGuid);
      const sanitizedFilename = this.sanitizeFilename(filename);
      const attachmentKey = `${attachmentPath}${sanitizedFilename}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: attachmentKey,
        ContentType: contentType,
        ContentLength: maxContentLength,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });

      return { uploadUrl, attachmentKey };
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code && ['INVALID_GUID', 'PAGE_NOT_FOUND'].includes(error.code)) {
        throw err;
      }

      throw this.createError(
        `Failed to generate upload URL: ${error.message}`,
        'PRESIGN_FAILED',
        500
      );
    }
  }

  /**
   * Head an attachment to verify it exists and get actual size/content-type.
   */
  async headAttachment(
    _pageGuid: string,
    attachmentKey: string
  ): Promise<{ contentLength: number; contentType: string | undefined } | null> {
    try {
      const response = await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: attachmentKey,
      }));
      return {
        contentLength: response.ContentLength ?? 0,
        contentType: response.ContentType,
      };
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Delete an attachment by its full S3 key (for cleanup).
   */
  async deleteAttachmentByKey(attachmentKey: string): Promise<void> {
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: attachmentKey,
    }));
  }

  /**
   * Sanitize filename for safe S3 storage
   * Preserves extension, removes/replaces unsafe characters
   */
  private sanitizeFilename(filename: string): string {
    // Remove path components
    const basename = filename.split(/[\\/]/).pop() || 'attachment';
    
    // Replace spaces with underscores
    // Remove or replace special characters that could cause issues
    // Keep alphanumeric, underscores, hyphens, dots
    let sanitized = basename
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    
    // Ensure we still have a valid filename
    if (!sanitized || sanitized === '.') {
      sanitized = 'attachment';
    }
    
    // Limit filename length to 255 characters (S3 supports up to 1024, but being conservative)
    if (sanitized.length > 255) {
      const lastDotIndex = sanitized.lastIndexOf('.');
      if (lastDotIndex > 0) {
        const ext = sanitized.substring(lastDotIndex);
        const name = sanitized.substring(0, 255 - ext.length);
        sanitized = name + ext;
      } else {
        sanitized = sanitized.substring(0, 255);
      }
    }
    
    return sanitized;
  }

  private async readBodyAsString(body: unknown): Promise<string> {
    if (!body) {
      return '';
    }

    if (typeof body === 'string') {
      return body;
    }

    if (Buffer.isBuffer(body)) {
      return body.toString('utf-8');
    }

    // Handle Node.js Readable streams (used in tests)
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf-8');
    }

    // Handle AWS SDK v3 response Body with transformToString
    if (typeof body === 'object' && body !== null && 'transformToString' in body) {
      const transformable = body as { transformToString: (encoding?: string) => Promise<string> };
      return transformable.transformToString('utf-8');
    }

    return String(body);
  }

  /**
   * Check if S3 is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({
        Bucket: this.bucketName,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('S3 health check failed:', error);
      return false;
    }
  }
}
