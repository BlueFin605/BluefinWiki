# Storage Plugin Architecture

**Purpose**: Define the pluggable storage architecture for BlueFinWiki pages and folders  
**Status**: Implemented  
**Last Updated**: February 6, 2026

## Overview

BlueFinWiki uses a **pluggable storage architecture** that abstracts page/folder persistence from the application logic. This enables support for multiple storage backends (S3, GitHub, local filesystem, etc.) without changing the core application code.

### Key Principles

1. **Pages ARE Folders**: A page is a markdown file, and if it has children, they are stored in a directory named `{page-guid}/`
2. **GUID-Based Storage**: All pages use UUID v4 identifiers for stable references
3. **Hierarchical Organization**: Pages can be nested in a parent-child relationship
4. **Storage Agnostic**: Application code works with any storage plugin implementing the interface

## Architecture

```
┌─────────────────────────────────────────┐
│   Application Layer (Lambda Functions)  │
│  (folder CRUD, page operations, etc.)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      StoragePlugin Interface            │
│  (savePage, loadPage, deletePage, etc.) │
└──────────────┬──────────────────────────┘
               │
      ┌────────┴────────┬──────────┐
      ▼                 ▼          ▼
┌───────────┐   ┌─────────────┐  ┌────────────┐
│ S3Storage │   │ GitHubStorage│  │LocalStorage│
│  Plugin   │   │    Plugin    │  │   Plugin   │
└───────────┘   └─────────────┘  └────────────┘
```

## File Organization

### Root-Level Pages
Pages at the root level are stored as:
```
{guid}.md
```

### Child Pages
Pages with a parent are stored as:
```
{parent-guid}/{guid}.md
```

### Nested Hierarchy Example
```
wiki-root/
  ├── 123e4567-e89b-12d3-a456-426614174000.md  (Root page: "Family Recipes")
  ├── 123e4567-e89b-12d3-a456-426614174000/
  │   ├── 987fcdeb-51a2-43f1-b2d4-8e7f6c5d4321.md  (Child: "Desserts")
  │   ├── 987fcdeb-51a2-43f1-b2d4-8e7f6c5d4321/
  │   │   └── aabbccdd-1234-5678-90ab-cdef01234567.md  (Grandchild: "Chocolate Cake")
  │   └── 111aaaaa-2222-3333-4444-555566667777.md  (Child: "Main Courses")
  └── 999zzzzz-8888-7777-6666-555544443333.md  (Root page: "Travel Logs")
```

## StoragePlugin Interface

### Methods

#### `savePage(guid, parentGuid, content): Promise<void>`
Save or update a page with its content and metadata.

**Parameters**:
- `guid`: Unique page identifier (UUID v4)
- `parentGuid`: Parent page GUID (null for root-level)
- `content`: PageContent object with metadata and markdown

**Behavior**:
- Create new page file at calculated path
- Store metadata in YAML frontmatter
- Store markdown content in body
- Enable versioning if supported by storage backend

**Error Conditions**:
- Invalid GUID format
- Missing required fields (title, content, creator)
- Storage backend failure

#### `loadPage(guid): Promise<PageContent>`
Load a page by its GUID.

**Parameters**:
- `guid`: Unique page identifier

**Returns**: PageContent with metadata and markdown

**Error Conditions**:
- Page not found (404)
- Invalid GUID format
- Storage backend failure
- Corrupted page metadata

#### `deletePage(guid, recursive): Promise<void>`
Delete a page and optionally all its children.

**Parameters**:
- `guid`: Unique page identifier
- `recursive`: If true, delete children; if false, fail if children exist

**Behavior**:
- If `recursive=true`: Delete page and all descendants
- If `recursive=false`: Only delete if no children exist
- Can implement soft delete by setting `deleted=true` in metadata

**Error Conditions**:
- Page has children and `recursive=false`
- Page not found
- Storage backend failure

#### `listVersions(guid): Promise<Version[]>`
List all versions of a page (if versioning is supported).

**Parameters**:
- `guid`: Unique page identifier

**Returns**: Array of Version objects, sorted newest first

**Error Conditions**:
- Page not found
- Versioning not supported by backend
- Storage backend failure

#### `listChildren(parentGuid): Promise<PageSummary[]>`
List all child pages of a parent (or root-level pages).

**Parameters**:
- `parentGuid`: Parent page GUID (null for root-level)

**Returns**: Array of PageSummary objects

**Behavior**:
- If `parentGuid=null`: List all `.md` files at root
- If `parentGuid` provided: List all `.md` files in `{parent-guid}/` directory
- Parse frontmatter to extract summary metadata
- Sort results alphabetically by title

**Error Conditions**:
- Storage backend failure
- Corrupted page metadata

#### `movePage(guid, newParentGuid): Promise<void>`
Move a page to a new parent (or to root level).

**Parameters**:
- `guid`: Page to move
- `newParentGuid`: New parent GUID (null for root)

**Behavior**:
- Validate no circular reference (page can't be moved into its own descendants)
- Recursively move page and all its children
- Update parent references in metadata

**Error Conditions**:
- Circular reference detected
- Page not found
- Storage backend failure

#### `healthCheck(): Promise<boolean>`
Check if the storage plugin is properly configured and accessible.

**Returns**: `true` if healthy, `false` otherwise

**Use Cases**:
- Startup health checks
- Monitoring and alerting
- Graceful degradation

#### `getType(): string`
Get the plugin type identifier.

**Returns**: Plugin type (e.g., `'s3'`, `'github'`, `'local'`)

## BaseStoragePlugin Abstract Class

The `BaseStoragePlugin` provides common functionality for all plugins:

### Validation Methods

- `validateGuid(guid)`: Check if string is valid UUID v4
- `validatePageContent(content)`: Validate page content structure
- `validateNoCircularReference(guid, newParentGuid)`: Prevent circular references in move operations

### Helper Methods

- `generateGuid()`: Create new UUID v4
- `createError(message, code, statusCode, details)`: Create standardized error
- `hasChildren(guid)`: Check if page has child pages
- `formatDate(date)`: Format date to ISO 8601

### Error Handling

All methods throw `StoragePluginError` with:
- `message`: Human-readable error description
- `code`: Machine-readable error code (e.g., `INVALID_GUID`, `CIRCULAR_REFERENCE`)
- `statusCode`: HTTP status code (optional)
- `details`: Additional error context (optional)

## Implementing a New Storage Plugin

To create a new storage plugin (e.g., for GitHub, Dropbox, etc.):

1. **Extend BaseStoragePlugin**:
   ```typescript
   export class GitHubStoragePlugin extends BaseStoragePlugin {
     constructor(config: GitHubConfig) {
       super('github');
       // Initialize GitHub API client
     }
   }
   ```

2. **Implement Required Methods**:
   - `savePage()`
   - `loadPage()`
   - `deletePage()`
   - `listVersions()`
   - `listChildren()`
   - `movePage()`
   - `healthCheck()`

3. **Handle Storage-Specific Logic**:
   - Path calculation
   - API authentication
   - Rate limiting
   - Caching
   - Transaction handling

4. **Use Base Class Utilities**:
   - Call `validatePageContent()` before saving
   - Call `validateNoCircularReference()` before moving
   - Use `createError()` for consistent error handling

5. **Register the Plugin**:
   ```typescript
   StoragePluginRegistry.register('github', GitHubStoragePlugin);
   ```

## Page Metadata Format

Pages are stored as Markdown files with YAML frontmatter:

```markdown
---
guid: "123e4567-e89b-12d3-a456-426614174000"
title: "Family Recipes"
parentGuid: null
tags: ["cooking", "family"]
status: "published"
createdBy: "user-123"
modifiedBy: "user-456"
createdAt: "2026-02-06T10:30:00Z"
modifiedAt: "2026-02-06T14:45:00Z"
---

# Family Recipes

Welcome to our family recipe collection!

## Featured Recipes
...
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_GUID` | GUID is not a valid UUID v4 | 400 |
| `INVALID_PAGE_CONTENT` | Missing required fields or invalid data | 400 |
| `CIRCULAR_REFERENCE` | Move would create circular reference | 400 |
| `PAGE_NOT_FOUND` | Page does not exist | 404 |
| `PAGE_HAS_CHILDREN` | Cannot delete page with children (non-recursive) | 409 |
| `STORAGE_ERROR` | Backend storage failure | 500 |
| `VERSION_NOT_SUPPORTED` | Versioning not available for this backend | 501 |

## Performance Considerations

### Caching Strategy

**No Backend In-Memory Caching for Lambda Architecture**:
- Lambda containers are ephemeral, recycled after 15-45 minutes of inactivity
- Cold starts reset any in-memory state, making instance-level caching unreliable
- For low-traffic family wikis (3-20 users), most requests hit cold Lambda containers
- S3 provides sub-10ms latency which is sufficient for this use case

**If Caching Is Needed in the Future**:
- Use **DynamoDB** for GUID → S3 key mapping (shared persistent state)
- Use **ElastiCache/Redis** for hot data (page metadata, frequently accessed pages)
- Use **CloudFront** for edge caching of static content and API responses
- Use **React Query** on frontend for client-side caching

**Current Implementation**:
- No in-memory caching in storage plugins
- Direct S3 API calls for all operations
- CloudFront caching for static assets only

### Batch Operations
- For large folder operations, implement pagination
- Use parallel requests where possible (e.g., S3 batch operations)
- Provide progress callbacks for long-running operations

### Circular Reference Detection
- The `validateNoCircularReference()` method may require multiple API calls
- Consider maintaining a parent-child index for O(1) lookups if performance becomes an issue
- Currently implemented as recursive traversal (acceptable for typical family wiki depth of 3-5 levels)

## Testing

Each storage plugin should have:

1. **Unit Tests**: Test individual methods with mocked backend
2. **Integration Tests**: Test against real backend (or LocalStack for AWS)
3. **Contract Tests**: Verify plugin implements StoragePlugin interface correctly
4. **Performance Tests**: Measure latency for typical operations

Example test structure:
```typescript
describe('S3StoragePlugin', () => {
  describe('savePage', () => {
    it('should save root-level page', async () => {});
    it('should save child page', async () => {});
    it('should throw on invalid GUID', async () => {});
  });
  
  describe('movePage', () => {
    it('should detect circular reference', async () => {});
    it('should move page and children', async () => {});
  });
});
```

## Migration Between Storage Backends

To migrate from one storage backend to another:

1. Implement both source and destination plugins
2. Use `listChildren(null)` recursively to enumerate all pages
3. For each page:
   - `loadPage()` from source
   - `savePage()` to destination
   - Preserve GUID, metadata, and hierarchy
4. Verify all pages migrated successfully
5. Switch application configuration to new backend

## Future Enhancements

- **Locking**: Implement optimistic or pessimistic locking for concurrent edits
- **Transactions**: Add transaction support for multi-page operations
- **Streaming**: Support streaming large pages for memory efficiency
- **Attachments**: Extend interface to handle binary attachments
- **Search Indexing**: Add hooks for search index updates on save/delete
- **Webhooks**: Trigger events on page changes for integrations

## References

- [Feature Spec: Folder Management](../../3-folder-management.md)
- [Task List](../../TASKS.md) - Phase 2, Tasks 3.1-3.2
- [Technical Plan](../../TECHNICAL-PLAN.md) - Storage Architecture Section
