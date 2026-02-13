# Pages API Lambda Functions

This module contains Lambda function handlers for all page CRUD operations in BlueFinWiki.

## Overview

These Lambda functions implement the `/pages` API endpoints, providing complete page management functionality including:
- Creating new pages
- Retrieving page content
- Updating page content and metadata
- Deleting pages (with optional recursive deletion)
- Listing child pages
- Moving pages to different parent locations

## Functions

### `pages-create.ts`
**POST /pages**

Creates a new page with the provided content and metadata.

**Request Body:**
```json
{
  "title": "Page Title",
  "content": "# Markdown content",
  "parentGuid": "parent-guid-or-null",
  "tags": ["tag1", "tag2"],
  "status": "draft"
}
```

**Response:** `201 Created`
```json
{
  "guid": "page-guid",
  "title": "Page Title",
  "parentGuid": "parent-guid-or-null",
  "createdAt": "2026-02-06T12:00:00Z"
}
```

---

### `pages-get.ts`
**GET /pages/{guid}**

Retrieves a page by its GUID including all metadata.

**Response:** `200 OK`
```json
{
  "guid": "page-guid",
  "title": "Page Title",
  "content": "# Markdown content",
  "folderId": "parent-guid-or-empty",
  "tags": ["tag1", "tag2"],
  "status": "published",
  "createdBy": "user-id",
  "modifiedBy": "user-id",
  "createdAt": "2026-02-06T12:00:00Z",
  "modifiedAt": "2026-02-06T12:00:00Z"
}
```

---

### `pages-update.ts`
**PUT /pages/{guid}**

Updates an existing page with new content and/or metadata. Creates a new version in S3.

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "content": "# Updated markdown content",
  "tags": ["tag1", "tag2"],
  "status": "published"
}
```

**Response:** `200 OK`
```json
{
  "guid": "page-guid",
  "title": "Updated Title",
  "modifiedAt": "2026-02-06T12:00:00Z",
  "modifiedBy": "user-id"
}
```

---

### `pages-delete.ts`
**DELETE /pages/{guid}?recursive=true|false**

Deletes a page and optionally all its children.

**Query Parameters:**
- `recursive`: `true|false` (default: `false`)
  - `true`: Delete page and all children recursively
  - `false`: Only delete if page has no children

**Permissions:** Admin only

**Response:** `200 OK`
```json
{
  "guid": "page-guid",
  "deleted": true,
  "recursive": true,
  "deletedCount": 5
}
```

---

### `pages-list-children.ts`
**GET /pages/{guid}/children** or **GET /pages/root/children**

Lists all child pages of a parent page, or root-level pages.

**Path Parameters:**
- `guid`: Parent page GUID (use `root` for root-level pages)

**Response:** `200 OK`
```json
{
  "parentGuid": "parent-guid-or-null",
  "children": [
    {
      "guid": "child-guid",
      "title": "Child Page Title",
      "parentGuid": "parent-guid",
      "status": "published",
      "modifiedAt": "2026-02-06T12:00:00Z",
      "modifiedBy": "user-id",
      "hasChildren": true
    }
  ],
  "count": 1
}
```

---

### `pages-move.ts`
**PUT /pages/{guid}/move**

Moves a page to a new parent location (or to root level).

**Request Body:**
```json
{
  "newParentGuid": "new-parent-guid-or-null"
}
```

**Validation:**
- Prevents moving page to itself
- Prevents circular references (page cannot be moved under its own descendant)
- Verifies target parent exists (if not null)

**Response:** `200 OK`
```json
{
  "guid": "page-guid",
  "newParentGuid": "new-parent-guid-or-null",
  "movedAt": "2026-02-06T12:00:00Z"
}
```

---

### `links-resolve.ts`
**POST /pages/links/resolve**

Resolves wiki links by page title or GUID with fuzzy matching and confidence scoring.

**Request Body:**
```json
{
  "query": "Page Title or GUID",
  "maxResults": 10
}
```

**Response:** `200 OK`
```json
{
  "query": "Page Title",
  "matches": [
    {
      "guid": "page-guid",
      "title": "Page Title",
      "parentGuid": "parent-guid-or-null",
      "status": "published",
      "confidence": 1.0,
      "path": "Parent > Page Title"
    }
  ],
  "exactMatch": true,
  "ambiguous": false,
  "exists": true
}
```

**Features:**
- **GUID Resolution**: If query is a valid GUID, returns exact match
- **Exact Title Match**: Case-insensitive exact title matching (confidence: 1.0)
- **Partial Match**: Substring matching (confidence: 0.7-0.95)
- **Fuzzy Match**: Levenshtein distance for typo tolerance (confidence: 0.5-0.7)
- **Ambiguous Detection**: Flags when multiple high-confidence matches exist
- **Hierarchical Path**: Shows full parent path for context

**Confidence Scoring:**
- `1.0`: Exact match (case-insensitive)
- `0.7-0.95`: Partial substring match
- `0.5-0.7`: Fuzzy match with typos
- `< 0.5`: Not returned (below threshold)

**Use Cases:**
- Wiki link autocomplete in editor
- Broken link detection
- Link validation before page creation
- Backlink resolution

---

## Authentication

All endpoints require authentication via Cognito JWT tokens. The `withAuth` middleware:
- Validates JWT tokens
- Extracts user context (userId, email, role, displayName)
- Attaches user context to the event

Include the token in the `Authorization` header:
```
Authorization: Bearer <cognito-access-token>
```

---

## Storage Plugin Integration

All functions use the storage plugin abstraction via `getStoragePlugin()`. This allows for:
- Pluggable storage backends (S3, GitHub, local filesystem)
- Consistent error handling
- Unified page management interface

The storage plugin must be initialized before these Lambda functions are invoked.

---

## Error Handling

All functions return consistent error responses:

**400 Bad Request:** Invalid input or validation errors
```json
{
  "error": "Validation failed",
  "details": { ... }
}
```

**401 Unauthorized:** Missing or invalid authentication token
```json
{
  "error": "Invalid or expired token"
}
```

**403 Forbidden:** User lacks required permissions
```json
{
  "error": "Only Admin users can delete pages"
}
```

**404 Not Found:** Page not found
```json
{
  "error": "Page not found"
}
```

**500 Internal Server Error:** Storage or system errors
```json
{
  "error": "Failed to create page",
  "code": "STORAGE_ERROR"
}
```

---

## Dependencies

- `@aws-sdk/client-s3`: S3 storage operations
- `aws-jwt-verify`: Cognito JWT validation
- `zod`: Request validation
- `uuid`: GUID generation

---

## Testing

To test these functions:

1. Set up the storage plugin (S3 or LocalStack)
2. Initialize Cognito user pool
3. Use AWS SAM Local or Lambda test events
4. Include valid Cognito access token in Authorization header

Example test event for `pages-create`:
```json
{
  "httpMethod": "POST",
  "path": "/pages",
  "headers": {
    "Authorization": "Bearer <token>"
  },
  "body": "{\"title\":\"Test Page\",\"content\":\"# Test Content\"}"
}
```

---

## API Gateway Integration

These functions should be integrated with API Gateway with the following routes:

- `POST /pages` → `pages-create`
- `GET /pages/{guid}` → `pages-get`
- `PUT /pages/{guid}` → `pages-update`
- `DELETE /pages/{guid}` → `pages-delete`
- `GET /pages/{guid}/children` → `pages-list-children`
- `PUT /pages/{guid}/move` → `pages-move`
- `POST /pages/links/resolve` → `links-resolve`

Configure API Gateway authorizer to use Cognito User Pool.

---

## Notes

- The API Gateway resource creation is not yet implemented (task 3.3 item 1)
- Page versioning is handled automatically by S3 versioning
- Circular reference detection uses recursive traversal up the parent chain
- Delete operations are restricted to Admin users only
- The `folderId` field in PageContent corresponds to `parentGuid` in API requests
