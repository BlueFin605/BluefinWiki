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
import { BaseStoragePlugin } from './BaseStoragePlugin.js';
import { PageContent, Version, PageSummary } from '../types/index.js';

interface S3StorageConfig {
  type?: 's3';
  bucketName: string;
  region?: string;
  endpoint?: string; // For LocalStack
}

export class S3StoragePlugin extends BaseStoragePlugin {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(config: S3StorageConfig) {
    super('s3');
    
    this.bucketName = config.bucketName;
    
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      ...(config.endpoint && { 
        endpoint: config.endpoint,
        forcePathStyle: true // Required for LocalStack
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
   * Parse YAML frontmatter from markdown content
   */
  private parseFrontmatter(content: string): { metadata: Record<string, string | string[] | undefined>; body: string } {
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

    // Simple YAML parser (supports basic key: value format and arrays)
    const metadata: Record<string, string | string[] | undefined> = {};
    const lines = yamlContent.split('\n');
    let currentKey: string | null = null;
    let currentArray: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
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

    return { metadata, body };
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
    
    // Add description if present
    if (content.description) {
      lines.push(`description: "${content.description}"`);
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

      // Try to find the page by searching
      const key = await this.findPageKey(guid);

      if (!key) {
        throw this.createError(
          `Page not found: ${guid}`,
          'PAGE_NOT_FOUND',
          404
        );
      }

      // Fetch from S3
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
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
      const markdown = await response.Body.transformToString();

      // Parse frontmatter
      const { metadata, body } = this.parseFrontmatter(markdown);

      // Build PageContent object
      const folderId = Array.isArray(metadata.folderId) ? metadata.folderId[0] : metadata.folderId;
      const parentGuid = Array.isArray(metadata.parentGuid) ? metadata.parentGuid[0] : metadata.parentGuid;
      const effectiveFolderId = folderId || parentGuid || '';
      
      const pageContent: PageContent = {
        guid: Array.isArray(metadata.guid) ? metadata.guid[0] : metadata.guid || guid,
        title: Array.isArray(metadata.title) ? metadata.title[0] : metadata.title || 'Untitled',
        content: body,
        folderId: (effectiveFolderId === null || effectiveFolderId === 'null') ? '' : effectiveFolderId,
        tags: Array.isArray(metadata.tags) ? metadata.tags : metadata.tags ? [metadata.tags] : [],
        status: (Array.isArray(metadata.status) ? metadata.status[0] : metadata.status || 'draft') as 'draft' | 'published' | 'archived' | 'deleted',
        description: Array.isArray(metadata.description) ? metadata.description[0] : metadata.description,
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
   * Find a page's S3 key by searching for its GUID
   * This is needed because we don't store the full path separately
   */
  private async findPageKey(guid: string): Promise<string | null> {
    try {
      // First, try as a root page (new structure: {guid}/{guid}.md)
      const rootKey = `${guid}/${guid}.md`;
      try {
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: rootKey,
        }));
        return rootKey;
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        if (error.name !== 'NotFound') {
          throw err;
        }
      }

      // Search for the page in all folders (new structure: {parent}/{guid}/{guid}.md)
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
              return obj.Key;
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
   * Delete a page from S3
   */
  async deletePage(guid: string, recursive: boolean = false): Promise<void> {
    try {
      // Validate GUID
      if (!this.validateGuid(guid)) {
        throw this.createError('Invalid GUID format', 'INVALID_GUID', 400);
      }

      // Find the page key
      const key = await this.findPageKey(guid);
      
      if (!key) {
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
          'Cannot delete page with children. Use recursive=true to delete all children.',
          'HAS_CHILDREN',
          400
        );
      }

      if (recursive && hasChildPages) {
        // Delete all children recursively
        await this.deletePageAndChildren(guid, key);
      } else {
        // Delete single page
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });
        await this.s3Client.send(deleteCommand);
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

      // Find the page key
      const key = await this.findPageKey(guid);
      
      if (!key) {
        throw this.createError(
          `Page not found: ${guid}`,
          'PAGE_NOT_FOUND',
          404
        );
      }

      // List object versions
      const command = new ListObjectVersionsCommand({
        Bucket: this.bucketName,
        Prefix: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Versions || response.Versions.length === 0) {
        return [];
      }

      // Convert to Version objects
      const versions: Version[] = response.Versions
        .filter(v => v.Key === key) // Only exact matches
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
      // Find the page's location
      const pageKey = await this.findPageKey(guid);
      if (!pageKey) {
        return false;
      }
      
      // Extract the page's folder path from its key
      // Key format: {ancestor-path}/{guid}/{guid}.md
      // We want: {ancestor-path}/{guid}/
      const pageFolder = pageKey.substring(0, pageKey.lastIndexOf('/') + 1);
      
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
          return folderGuid !== guid; // Exclude the page's own guid folder
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
                      modifiedAt: page.modifiedAt,
                      modifiedBy: page.modifiedBy,
                      hasChildren: await this.hasChildrenDirect(guid),
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
        
        // First, find the parent's location to build the correct prefix
        const parentKey = await this.findPageKey(parentGuid);
        if (!parentKey) {
          // Parent not found, return empty
          return [];
        }
        
        // Extract the parent's folder path from its key
        // Key format: {ancestor-path}/{parentGuid}/{parentGuid}.md
        // We want: {ancestor-path}/{parentGuid}/
        const parentFolder = parentKey.substring(0, parentKey.lastIndexOf('/') + 1);
        
        console.log(`[listChildren] Parent: ${parentGuid}, ParentKey: ${parentKey}, ParentFolder: ${parentFolder}`);
        
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
                    modifiedAt: page.modifiedAt,
                    modifiedBy: page.modifiedBy,
                    hasChildren: await this.hasChildrenDirect(guid),
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

      // Sort by title
      children.sort((a, b) => a.title.localeCompare(b.title));

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
      const oldKey = await this.findPageKey(guid);

      if (!oldKey) {
        throw this.createError(
          `Page not found: ${guid}`,
          'PAGE_NOT_FOUND',
          404
        );
      }

      // Build new key
      const newKey = await this.buildPageKey(guid, newParentGuid);

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
        const childOldKey = await this.findPageKey(child.guid);
        if (childOldKey) {
          // Copy child to new location
          const childNewKey = await this.buildPageKey(child.guid, guid);
          
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
