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

### Running Integration Tests

Integration tests validate the storage plugin against real S3 behavior using LocalStack. These tests are essential for verifying:
- Actual S3 API interactions
- Versioning behavior
- Concurrency handling
- Error conditions
- Performance characteristics

#### Prerequisites

1. **Start Aspire with LocalStack**:
   ```powershell
   # From repository root
   dotnet run --project aspire/BlueFinWiki.AppHost
   ```
   
   This starts:
   - LocalStack (S3, DynamoDB, SES) on `http://localhost:4566`
   - Aspire Dashboard on `http://localhost:15888`
   - Other services (Cognito Local, MailHog)

2. **Verify LocalStack is Running**:
   ```powershell
   # Check LocalStack health
   curl http://localhost:4566/_localstack/health
   ```
   
   Expected response:
   ```json
   {
     "services": {
       "s3": "running",
       "dynamodb": "running",
       "ses": "running"
     }
   }
   ```

#### Running the Tests

```powershell
# From backend directory
cd backend

# Run integration tests only
npm run test:integration

# Run all tests (unit + integration)
npm run test:all

# Run integration tests with verbose output
npm run test:integration -- --reporter=verbose

# Run specific integration test file
npm run test:integration -- S3StoragePlugin.integration.test.ts
```

#### Integration Test Coverage

The integration tests cover:

**Core Operations**:
- End-to-end page lifecycle (create, read, update, delete)
- Page hierarchy management (parent-child relationships)
- Page movement between parents
- Recursive deletion

**Advanced Features**:
- S3 versioning behavior with multiple updates
- Root-level and nested page listing
- Deletion protection (prevent deleting parents with children)
- Error handling (non-existent pages, circular references)

**Performance Tests**:
- **Bulk Operations**: Creating and listing 100+ pages
- **Large Content**: Handling 5MB page content
- **Deep Hierarchies**: Testing 10-level nested structures
- **Wide Hierarchies**: Managing 100 children under one parent
- **Concurrent Operations**: 50 simultaneous read/write operations
- **Versioning Stress**: 20+ rapid updates to track version history
- **Bulk Deletion**: Recursive deletion of parent with 50 children

#### Performance Benchmarks

Expected performance targets for LocalStack (actual AWS S3 will be faster):

| Operation | Target Time | Test Scale |
|-----------|-------------|------------|
| Create 100 pages | < 30 seconds | Parallel creation |
| List 100 pages | < 5 seconds | Single list operation |
| Save 5MB page | < 10 seconds | Single large file |
| Load 5MB page | < 5 seconds | Single large file |
| Create 10-level hierarchy | < 15 seconds | Sequential nesting |
| List 100 children | < 5 seconds | Wide hierarchy |
| Bulk delete (50 pages) | < 10 seconds | Recursive deletion |
| 50 concurrent ops | < 20 seconds | Mixed read/write |
| 20 versions | < 15 seconds | Sequential updates |

#### Monitoring Tests with Aspire Dashboard

1. Open Aspire Dashboard: `http://localhost:15888`
2. Navigate to "Traces" tab
3. Run integration tests
4. View distributed traces showing:
   - S3 API calls (PutObject, GetObject, etc.)
   - Request timings and latencies
   - Error conditions and retries
   - Performance bottlenecks

#### Troubleshooting Integration Tests

**LocalStack not responding**:
```powershell
# Restart Aspire
dotnet run --project aspire/BlueFinWiki.AppHost

# Or restart just LocalStack container
docker restart <localstack-container-id>
```

**Test timeouts**:
- Performance tests have 60-second timeout
- Regular tests have 30-second timeout
- Adjust in `vitest.integration.config.ts` if needed

**S3 bucket conflicts**:
- Tests clean up after themselves
- Manually delete bucket if needed:
  ```powershell
  aws --endpoint-url=http://localhost:4566 s3 rb s3://bluefinwiki-test-pages --force
  ```

**Debug mode**:
```powershell
# Run tests with debug logging
DEBUG=* npm run test:integration
```

#### CI/CD Integration

In GitHub Actions, integration tests run automatically:
1. Spin up LocalStack using Docker Compose
2. Wait for LocalStack health check
3. Run `npm run test:integration`
4. Collect test results and coverage

See `.github/workflows/backend.yml` for implementation.

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
