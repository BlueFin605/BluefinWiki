# Storage Plugin Developer Guide

This guide explains how to create custom storage plugins for BlueFinWiki. Storage plugins allow you to integrate alternative backends beyond S3, such as GitHub, GitLab, local filesystem, or any other storage solution.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Plugin Interface](#plugin-interface)
- [Creating a Custom Plugin](#creating-a-custom-plugin)
- [Best Practices](#best-practices)
- [Testing Your Plugin](#testing-your-plugin)
- [Registration and Configuration](#registration-and-configuration)
- [Examples](#examples)

## Overview

BlueFinWiki uses a pluggable storage architecture that allows different backends for page persistence. The storage plugin interface abstracts away the specifics of where and how pages are stored, allowing the core application logic to remain backend-agnostic.

### Why Plugin Architecture?

- **Flexibility**: Support multiple storage backends (S3, GitHub, local filesystem, etc.)
- **Testability**: Easily mock storage for unit tests
- **Portability**: Switch backends without changing application code
- **Extensibility**: Add new backends without modifying core code

### Supported Backends

Out of the box, BlueFinWiki supports:

- **S3StoragePlugin**: AWS S3 (primary, production-ready)
- **LocalStoragePlugin**: (Planned) Local filesystem for development
- **GitHubStoragePlugin**: (Planned) GitHub repository as backend
- **Custom**: You can implement your own!

## Architecture

### Component Overview

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (Lambda Functions, API Handlers)       │
└────────────────┬────────────────────────┘
                 │
                 │ Uses
                 ▼
┌─────────────────────────────────────────┐
│      StoragePlugin Interface            │
│  (Abstract Contract)                    │
└────────────────┬────────────────────────┘
                 │
                 │ Implements
                 ▼
┌─────────────────────────────────────────┐
│    BaseStoragePlugin                    │
│  (Common functionality)                 │
└────────────────┬────────────────────────┘
                 │
                 │ Extends
                 ▼
┌─────────────────────────────────────────┐
│   Concrete Plugin Implementations       │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │   S3     │ │  GitHub  │ │  Local  │ │
│  └──────────┘ └──────────┘ └─────────┘ │
└─────────────────────────────────────────┘
```

### Data Flow

1. **Request** → API Handler receives request (create page, update page, etc.)
2. **Handler** → Calls storage plugin method (`savePage`, `loadPage`, etc.)
3. **Plugin** → Translates request to backend-specific operations
4. **Backend** → Performs actual storage operation (S3 PutObject, GitHub commit, etc.)
5. **Response** → Plugin returns standardized result to handler
6. **Handler** → Returns response to client

## Plugin Interface

All storage plugins must implement the `StoragePlugin` interface:

```typescript
export interface StoragePlugin {
  /**
   * Save a page with its content and metadata
   */
  savePage(
    guid: string,
    parentGuid: string | null,
    content: PageContent
  ): Promise<void>;

  /**
   * Load a page by its GUID
   */
  loadPage(guid: string): Promise<PageContent>;

  /**
   * Delete a page and optionally all its children
   */
  deletePage(guid: string, recursive?: boolean): Promise<void>;

  /**
   * List all versions of a page
   */
  listVersions(guid: string): Promise<Version[]>;

  /**
   * List all child pages of a parent (or root-level pages)
   */
  listChildren(parentGuid: string | null): Promise<PageSummary[]>;

  /**
   * Move a page to a new parent (or to root level)
   */
  movePage(guid: string, newParentGuid: string | null): Promise<void>;

  /**
   * Check if the storage plugin is properly configured and accessible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get the plugin type identifier
   */
  getType(): string;
}
```

### Type Definitions

```typescript
export interface PageContent {
  guid: string;
  title: string;
  content: string; // Markdown content
  folderId: string; // Parent GUID or empty string
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  createdBy: string; // Cognito user ID
  modifiedBy: string; // Cognito user ID
  createdAt: string; // ISO 8601
  modifiedAt: string; // ISO 8601
}

export interface Version {
  versionId: string;
  timestamp: string; // ISO 8601
  modifiedBy: string;
  size: number; // in bytes
}

export interface PageSummary {
  guid: string;
  title: string;
  parentGuid: string | null;
  status: 'draft' | 'published' | 'archived';
  modifiedAt: string;
  modifiedBy: string;
  hasChildren: boolean;
}

export interface StoragePluginError extends Error {
  code: string;
  statusCode?: number;
  details?: any;
}
```

## Creating a Custom Plugin

### Step 1: Extend BaseStoragePlugin

Start by extending the `BaseStoragePlugin` class, which provides common functionality:

```typescript
import { BaseStoragePlugin } from './BaseStoragePlugin.js';
import { PageContent, Version, PageSummary } from '../types/index.js';

export class MyCustomStoragePlugin extends BaseStoragePlugin {
  constructor(config: MyCustomConfig) {
    super('my-custom-plugin'); // Plugin type identifier
    
    // Initialize your backend client/connection
  }

  // Implement required methods...
}
```

### Step 2: Implement savePage

Save a page to your backend:

```typescript
async savePage(
  guid: string,
  parentGuid: string | null,
  content: PageContent
): Promise<void> {
  try {
    // 1. Validate inputs
    if (!this.validateGuid(guid)) {
      throw this.createError('Invalid GUID', 'INVALID_GUID', 400);
    }

    // 2. Build file path/key based on hierarchy
    const path = this.buildPath(guid, parentGuid);

    // 3. Serialize content (e.g., Markdown with frontmatter)
    const fileContent = this.serializeContent(content);

    // 4. Write to your backend
    await this.backend.write(path, fileContent);

  } catch (error) {
    throw this.createError(
      `Failed to save page: ${error.message}`,
      'SAVE_FAILED',
      500,
      { guid, parentGuid }
    );
  }
}
```

### Step 3: Implement loadPage

Load a page from your backend:

```typescript
async loadPage(guid: string): Promise<PageContent> {
  try {
    // 1. Find the page (may need to search if parent unknown)
    const path = await this.findPagePath(guid);

    // 2. Read from backend
    const fileContent = await this.backend.read(path);

    // 3. Parse content (extract frontmatter and markdown)
    const pageContent = this.parseContent(fileContent);

    return pageContent;

  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      throw this.createError(
        `Page not found: ${guid}`,
        'PAGE_NOT_FOUND',
        404,
        { guid }
      );
    }
    throw error;
  }
}
```

### Step 4: Implement deletePage

Delete a page and optionally its children:

```typescript
async deletePage(guid: string, recursive: boolean = false): Promise<void> {
  try {
    // 1. Check if page has children
    const children = await this.listChildren(guid);

    if (children.length > 0 && !recursive) {
      throw this.createError(
        'Page has children. Use recursive=true to delete all.',
        'HAS_CHILDREN',
        400,
        { guid, childCount: children.length }
      );
    }

    // 2. If recursive, delete all children first
    if (recursive) {
      for (const child of children) {
        await this.deletePage(child.guid, true);
      }
    }

    // 3. Delete the page itself
    const path = await this.findPagePath(guid);
    await this.backend.delete(path);

  } catch (error) {
    throw this.createError(
      `Failed to delete page: ${error.message}`,
      'DELETE_FAILED',
      500,
      { guid }
    );
  }
}
```

### Step 5: Implement listVersions

List all versions of a page:

```typescript
async listVersions(guid: string): Promise<Version[]> {
  try {
    // 1. Find page path
    const path = await this.findPagePath(guid);

    // 2. Query backend for versions
    const backendVersions = await this.backend.listVersions(path);

    // 3. Transform to standard Version format
    const versions: Version[] = backendVersions.map(v => ({
      versionId: v.id,
      timestamp: v.timestamp,
      modifiedBy: v.author,
      size: v.size,
    }));

    // 4. Sort by timestamp (newest first)
    versions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return versions;

  } catch (error) {
    throw this.createError(
      `Failed to list versions: ${error.message}`,
      'LIST_VERSIONS_FAILED',
      500,
      { guid }
    );
  }
}
```

### Step 6: Implement listChildren

List child pages of a parent:

```typescript
async listChildren(parentGuid: string | null): Promise<PageSummary[]> {
  try {
    // 1. Determine search path
    const searchPath = parentGuid ? `${parentGuid}/` : '';

    // 2. List files at this level (not recursive)
    const files = await this.backend.listFiles(searchPath, { recursive: false });

    // 3. Filter for .md files only
    const pageFiles = files.filter(f => f.endsWith('.md'));

    // 4. Load metadata from each page
    const summaries: PageSummary[] = [];
    for (const file of pageFiles) {
      const content = await this.backend.read(file);
      const { metadata } = this.parseContent(content);
      
      // Check if page has children
      const childPath = file.replace('.md', '/');
      const hasChildren = await this.backend.exists(childPath);

      summaries.push({
        guid: metadata.guid,
        title: metadata.title,
        parentGuid: parentGuid,
        status: metadata.status,
        modifiedAt: metadata.modifiedAt,
        modifiedBy: metadata.modifiedBy,
        hasChildren,
      });
    }

    return summaries;

  } catch (error) {
    throw this.createError(
      `Failed to list children: ${error.message}`,
      'LIST_CHILDREN_FAILED',
      500,
      { parentGuid }
    );
  }
}
```

### Step 7: Implement movePage

Move a page to a new parent:

```typescript
async movePage(guid: string, newParentGuid: string | null): Promise<void> {
  try {
    // 1. Validate no circular reference
    if (guid === newParentGuid) {
      throw this.createError(
        'Cannot move page to itself',
        'CIRCULAR_REFERENCE',
        400
      );
    }

    // 2. Check if moving under a descendant (traverse up from newParent)
    if (newParentGuid) {
      let current = newParentGuid;
      while (current) {
        if (current === guid) {
          throw this.createError(
            'Cannot move page under its own descendant',
            'CIRCULAR_REFERENCE',
            400
          );
        }
        const parent = await this.loadPage(current);
        current = parent.folderId || null;
      }
    }

    // 3. Load current page
    const page = await this.loadPage(guid);
    const oldPath = await this.findPagePath(guid);

    // 4. Build new path
    const newPath = this.buildPath(guid, newParentGuid);

    // 5. Update frontmatter
    page.folderId = newParentGuid || '';

    // 6. If page has children, move them too
    const children = await this.listChildren(guid);
    
    // 7. Copy to new location
    const newContent = this.serializeContent(page);
    await this.backend.write(newPath, newContent);

    // 8. Move children (if any)
    for (const child of children) {
      await this.movePage(child.guid, guid);
    }

    // 9. Delete old location
    await this.backend.delete(oldPath);

  } catch (error) {
    throw this.createError(
      `Failed to move page: ${error.message}`,
      'MOVE_FAILED',
      500,
      { guid, newParentGuid }
    );
  }
}
```

### Step 8: Implement healthCheck

Check if your backend is accessible:

```typescript
async healthCheck(): Promise<boolean> {
  try {
    // Perform a simple operation to verify connectivity
    await this.backend.ping();
    return true;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}
```

### Step 9: Implement getType

Return your plugin type identifier:

```typescript
getType(): string {
  return 'my-custom-plugin';
}
```

## Best Practices

### Error Handling

1. **Use standardized errors**: Always use `createError()` for consistent error format
2. **Include context**: Add relevant details to error objects
3. **Handle backend errors**: Wrap backend-specific errors in StoragePluginError
4. **Validate inputs**: Check GUIDs, parent references, etc.

### Performance

1. **Cache intelligently**: Build in-memory indexes for frequently accessed data
2. **Batch operations**: When possible, batch multiple backend calls
3. **Minimize round trips**: Fetch metadata with content when appropriate
4. **Use pagination**: For large lists of children or versions

### Data Integrity

1. **Atomic operations**: Ensure moves and deletes are transactional
2. **Verify before delete**: Check for children before non-recursive delete
3. **Validate hierarchy**: Prevent circular references
4. **Sync metadata**: Keep frontmatter in sync with structure

### Versioning

1. **Preserve history**: Don't overwrite versions; create new ones
2. **Include metadata**: Store who, when, and why for each version
3. **Implement cleanup**: Consider lifecycle policies for old versions

### Testing

1. **Unit tests**: Mock your backend for fast, isolated tests
2. **Integration tests**: Test against real backend in development
3. **Edge cases**: Test error scenarios, empty results, large hierarchies
4. **Performance tests**: Ensure scalability with large datasets

## Testing Your Plugin

### Unit Tests

Create unit tests with mocked backend:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyCustomStoragePlugin } from './MyCustomStoragePlugin.js';

describe('MyCustomStoragePlugin', () => {
  let plugin: MyCustomStoragePlugin;
  let mockBackend: any;

  beforeEach(() => {
    mockBackend = {
      read: vi.fn(),
      write: vi.fn(),
      delete: vi.fn(),
      listFiles: vi.fn(),
    };

    plugin = new MyCustomStoragePlugin({ backend: mockBackend });
  });

  it('should save a page', async () => {
    mockBackend.write.mockResolvedValue(undefined);

    await plugin.savePage('guid-123', null, {
      guid: 'guid-123',
      title: 'Test',
      content: 'Content',
      // ... other fields
    });

    expect(mockBackend.write).toHaveBeenCalledTimes(1);
  });

  // More tests...
});
```

### Integration Tests

Test against real backend in a sandbox environment:

```typescript
describe('MyCustomStoragePlugin Integration', () => {
  let plugin: MyCustomStoragePlugin;

  beforeAll(async () => {
    plugin = new MyCustomStoragePlugin({
      endpoint: process.env.TEST_ENDPOINT,
      // ... other config
    });

    // Set up test environment
    await plugin.healthCheck();
  });

  it('should perform end-to-end page lifecycle', async () => {
    const guid = 'test-page-123';

    // Create
    await plugin.savePage(guid, null, testPageContent);

    // Read
    const loaded = await plugin.loadPage(guid);
    expect(loaded.guid).toBe(guid);

    // Update
    await plugin.savePage(guid, null, updatedContent);

    // Delete
    await plugin.deletePage(guid);
  });
});
```

## Registration and Configuration

### Register Your Plugin

Add your plugin to the registry:

```typescript
// src/storage/index.ts
import { StoragePluginRegistry } from './StoragePluginRegistry.js';
import { S3StoragePlugin } from './S3StoragePlugin.js';
import { MyCustomStoragePlugin } from './MyCustomStoragePlugin.js';

const registry = new StoragePluginRegistry();

// Register plugins
registry.register('s3', (config) => new S3StoragePlugin(config));
registry.register('custom', (config) => new MyCustomStoragePlugin(config));

export { registry };
```

### Configure via Environment

Set configuration via environment variables:

```typescript
// Lambda function handler
import { registry } from './storage/index.js';

const storageType = process.env.STORAGE_TYPE || 's3';
const plugin = registry.create(storageType, {
  // Type-specific configuration
  bucketName: process.env.PAGES_BUCKET,
  region: process.env.AWS_REGION,
  // ... or custom backend config
});
```

## Examples

### Example: GitHub Storage Plugin (Conceptual)

```typescript
export class GitHubStoragePlugin extends BaseStoragePlugin {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch: string;

  constructor(config: GitHubStorageConfig) {
    super('github');
    
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch || 'main';
  }

  async savePage(guid: string, parentGuid: string | null, content: PageContent): Promise<void> {
    const path = this.buildPath(guid, parentGuid);
    const fileContent = this.serializeContent(content);
    
    // Check if file exists (for update)
    let sha: string | undefined;
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.branch,
      });
      if ('sha' in data) {
        sha = data.sha;
      }
    } catch (error) {
      // File doesn't exist, will create new
    }

    // Create or update file
    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message: `Update page: ${content.title}`,
      content: Buffer.from(fileContent).toString('base64'),
      sha, // Include SHA for updates
      branch: this.branch,
    });
  }

  // ... implement other methods
}
```

### Example: Local Filesystem Plugin (Conceptual)

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export class LocalStoragePlugin extends BaseStoragePlugin {
  private basePath: string;

  constructor(config: LocalStorageConfig) {
    super('local');
    this.basePath = config.basePath;
  }

  async savePage(guid: string, parentGuid: string | null, content: PageContent): Promise<void> {
    const relativePath = this.buildPath(guid, parentGuid);
    const fullPath = path.join(this.basePath, relativePath);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write file
    const fileContent = this.serializeContent(content);
    await fs.writeFile(fullPath, fileContent, 'utf-8');
  }

  async loadPage(guid: string): Promise<PageContent> {
    const filePath = await this.findPagePath(guid);
    const fullPath = path.join(this.basePath, filePath);
    
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    return this.parseContent(fileContent);
  }

  // ... implement other methods
}
```

## Additional Resources

- [S3 Storage Architecture](./S3-STORAGE-ARCHITECTURE.md) - Deep dive into S3 implementation
- [StoragePlugin Interface](../src/storage/StoragePlugin.ts) - Full interface definition
- [BaseStoragePlugin](../src/storage/BaseStoragePlugin.ts) - Base class implementation
- [S3StoragePlugin](../src/storage/S3StoragePlugin.ts) - Reference implementation

## Contributing

If you create a useful storage plugin, consider contributing it back to the project:

1. Fork the repository
2. Create your plugin in `src/storage/`
3. Add comprehensive tests
4. Document configuration and usage
5. Submit a pull request

For questions or support, open an issue on GitHub.
