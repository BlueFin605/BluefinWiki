# Attachment System Migration: GUID to Filename

**Date**: 2026-03-09  
**Status**: ✅ Completed

## Overview

Migrated the attachment system from using GUIDs as identifiers to using filenames. This change makes the system more debuggable, prevents duplicate detection easier, and provides human-readable URLs.

## Motivation

**Before**: Attachments were stored as `{pageGuid}/_attachments/{randomGuid}.ext` with original filename in metadata  
**After**: Attachments stored as `{pageGuid}/_attachments/{sanitized-filename.ext}`

### Benefits

1. **Duplicate Detection**: Same filename = easy to detect duplicates
2. **Debugging**: URLs like `/attachments/report.pdf` instead of `/attachments/550e8400-e29b...`
3. **User-Friendly**: Clear attachment identity without metadata lookup
4. **Storage Efficiency**: Automatic deduplication when same file uploaded twice

## Changes Made

### Backend Changes

#### 1. Type Updates (`backend/src/types/index.ts`)

```typescript
// Before
export interface AttachmentUploadResult {
  attachmentGuid: string;
  attachmentKey: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface AttachmentMetadata {
  attachmentId: string;
  originalFilename: string;
  // ...
}

// After  
export interface AttachmentUploadResult {
  filename: string;  // Changed: filename is now the primary identifier
  attachmentKey: string;
  contentType: string;
  size: number;
}

export interface AttachmentMetadata {
  filename: string;  // Changed: filename replaces attachmentId
  contentType: string;
  // ...
}
```

#### 2. Storage Plugin Interface (`backend/src/storage/StoragePlugin.ts`)

```typescript
// Before
deleteAttachment(pageGuid: string, attachmentGuid: string): Promise<void>;
getAttachmentUrl(pageGuid: string, attachmentGuid: string): Promise<string>;
saveAttachmentMetadata(pageGuid: string, attachmentGuid: string, metadata: AttachmentMetadata): Promise<void>;
getAttachmentMetadata(pageGuid: string, attachmentGuid: string): Promise<AttachmentMetadata>;

// After
deleteAttachment(pageGuid: string, filename: string): Promise<void>;
getAttachmentUrl(pageGuid: string, filename: string): Promise<string>;
saveAttachmentMetadata(pageGuid: string, filename: string, metadata: AttachmentMetadata): Promise<void>;
getAttachmentMetadata(pageGuid: string, filename: string): Promise<AttachmentMetadata>;
```

#### 3. S3 Storage Implementation (`backend/src/storage/S3StoragePlugin.ts`)

**Key Changes**:
- Removed `generateGuid()` call from `uploadAttachment()`
- Added `sanitizeFilename()` helper to clean filenames
- Removed `findAttachmentKey()` helper (no longer needed)
- Removed `extractSafeExtension()` helper (extension preserved in filename)
- Updated all attachment methods to use filename instead of GUID

**Filename Sanitization**:
```typescript
private sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = filename.split(/[\\/]/).pop() || 'attachment';
  
  // Replace spaces with underscores
  // Remove or replace special characters
  // Keep alphanumeric, underscores, hyphens, dots
  let sanitized = basename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  
  // Limit to 255 characters
  if (sanitized.length > 255) {
    // Preserve extension
    // ...
  }
  
  return sanitized;
}
```

#### 4. Lambda Handlers

**Upload** (`backend/src/pages/pages-attachments-upload.ts`):
```typescript
// Before
body: JSON.stringify({
  attachmentGuid: uploaded.attachmentGuid,
  filename: uploaded.filename,
  // ...
})

// After
body: JSON.stringify({
  filename: uploaded.filename,  // filename is now the identifier
  contentType: uploaded.contentType,
  // ...
})
```

**Download** (`backend/src/pages/pages-attachments-download.ts`):
```typescript
// Before
GET /pages/{pageGuid}/attachments/{attachmentGuid}
const attachmentGuid = event.pathParameters?.attachmentGuid;

// After
GET /pages/{pageGuid}/attachments/{filename}
const filename = event.pathParameters?.filename;
```

**Delete** (`backend/src/pages/pages-attachments-delete.ts`):
```typescript
// Before
DELETE /pages/{pageGuid}/attachments/{attachmentGuid}

// After
DELETE /pages/{pageGuid}/attachments/{filename}
```

### Frontend Changes

#### 1. Type Updates (`frontend/src/types/attachment.ts`)

```typescript
// Before
export interface AttachmentMetadata {
  attachmentId: string;
  originalFilename: string;
  // ...
}

export interface AttachmentUploadResponse {
  attachmentGuid: string;
  filename: string;
  // ...
}

export interface AttachmentUploadProgress {
  attachmentGuid?: string;
  // ...
}

// After
export interface AttachmentMetadata {
  filename: string;  // Replaced attachmentId
  contentType: string;
  // ...
}

export interface AttachmentUploadResponse {
  filename: string;  // Removed attachmentGuid
  contentType: string;
  // ...
}

export interface AttachmentUploadProgress {
  filename?: string;  // Replaced attachmentGuid
  // ...
}
```

#### 2. Hooks (`frontend/src/hooks/useAttachments.ts`)

```typescript
// Before
const deleteAttachment = useCallback(async (attachmentGuid: string) => {
  await apiClient.delete(`/pages/${pageGuid}/attachments/${attachmentGuid}`);
}, [pageGuid]);

// After
const deleteAttachment = useCallback(async (filename: string) => {
  await apiClient.delete(`/pages/${pageGuid}/attachments/${encodeURIComponent(filename)}`);
}, [pageGuid]);
```

#### 3. Components

**AttachmentUploader** (`frontend/src/components/editor/AttachmentUploader.tsx`):
```typescript
// Before
interface AttachmentUploaderProps {
  onUploadComplete?: (attachmentGuid: string, filename: string, url: string) => void;
  onInsertMarkdown?: (attachmentGuid: string, filename: string, isImage: boolean) => void;
}

// After
interface AttachmentUploaderProps {
  onUploadComplete?: (filename: string, url: string) => void;
  onInsertMarkdown?: (filename: string, isImage: boolean) => void;
}
```

**AttachmentUploadList** (`frontend/src/components/editor/AttachmentUploadList.tsx`):
```typescript
// Before
const { file, progress, status, error, attachmentGuid } = upload;
if (attachmentGuid && onInsertMarkdown) {
  onInsertMarkdown(attachmentGuid, file.name, isImageFile(file));
}

// After
const { file, progress, status, error, filename } = upload;
if (filename && onInsertMarkdown) {
  onInsertMarkdown(filename, isImageFile(file));
}
```

**AttachmentManager** (`frontend/src/components/editor/AttachmentManager.tsx`):
- Updated all references from `attachment.attachmentId` to `attachment.filename`
- Updated all references from `attachment.originalFilename` to `attachment.filename`
- Updated URL construction to use `encodeURIComponent(filename)`
- Updated image URL caching to use filename as key
- Updated preview system to use filename as key

## API Changes

### Endpoints

| Method | Before | After |
|--------|--------|-------|
| POST | `/pages/{pageGuid}/attachments` | `/pages/{pageGuid}/attachments` |
| GET | `/pages/{pageGuid}/attachments/{attachmentGuid}` | `/pages/{pageGuid}/attachments/{filename}` |
| DELETE | `/pages/{pageGuid}/attachments/{attachmentGuid}` | `/pages/{pageGuid}/attachments/{filename}` |
| GET | `/pages/{pageGuid}/attachments` | `/pages/{pageGuid}/attachments` |

### Response Changes

**Upload Response**:
```json
// Before
{
  "attachmentGuid": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "report.pdf",
  "contentType": "application/pdf",
  "size": 12345,
  "url": "https://..."
}

// After
{
  "filename": "report.pdf",
  "contentType": "application/pdf",
  "size": 12345,
  "url": "https://..."
}
```

**List Response**:
```json
// Before
{
  "attachments": [
    {
      "attachmentId": "550e8400-...",
      "originalFilename": "report.pdf",
      ...
    }
  ]
}

// After
{
  "attachments": [
    {
      "filename": "report.pdf",
      ...
    }
  ]
}
```

## Storage Structure

### S3 Bucket Layout

**Before**:
```
{pageGuid}/
  {pageGuid}.md
  _attachments/
    {randomGuid1}.pdf
    {randomGuid1}.meta.json
    {randomGuid2}.jpg
    {randomGuid2}.meta.json
```

**After**:
```
{pageGuid}/
  {pageGuid}.md
  _attachments/
    report.pdf
    report.pdf.meta.json
    family-photo.jpg
    family-photo.jpg.meta.json
```

## Migration Notes

⚠️ **Breaking Change**: This is a breaking change for existing attachments

### For Existing Deployments

If you have existing attachments stored with GUIDs, you'll need to:

1. **Option 1: Fresh Start** (Recommended for dev/testing)
   - Clear all existing attachments
   - Re-upload with new naming scheme

2. **Option 2: Migration Script** (For production)
   - Create a migration script to:
     - List all existing attachments
     - Read metadata to get original filename
     - Rename GUID-based files to use sanitized filename
     - Update metadata files

3. **Option 3: Dual Support** (Temporary)
   - Modify download handler to support both formats
   - Check if parameter is GUID or filename
   - Route accordingly
   - Phase out GUID support over time

## Testing

### Tests Requiring Updates

Backend tests:
- `backend/src/pages/__tests__/page-attachments.integration.test.ts`
- `backend/src/pages/__tests__/pages-attachments-storage.integration.test.ts`
- `backend/src/pages/__tests__/pages-attachments-list.test.ts`
- `backend/src/pages/__tests__/pages-attachments-delete.test.ts`
- `backend/src/storage/__tests__/S3StoragePlugin.test.ts`

Frontend tests:
- `frontend/src/hooks/__tests__/useAttachments.test.ts`

### Test Changes Summary

Replace all instances of:
- `attachmentGuid` → `filename`
- `attachmentId` → `filename`
- `originalFilename` → `filename`
- GUID validation checks → filename validation checks
- GUID mock values → realistic filename mock values

## Security Considerations

1. **Filename Sanitization**: All filenames are sanitized to prevent:
   - Path traversal attacks (`../../../etc/passwd`)
   - Special characters that could break storage systems
   - Excessively long filenames

2. **URL Encoding**: Filenames are URL-encoded when used in paths:
   ```typescript
   `/pages/${pageGuid}/attachments/${encodeURIComponent(filename)}`
   ```

3. **Duplicate Handling**: Same filename = overwrite
   - Consider adding version numbering if preservation needed
   - Consider warning user before overwrite

## Future Enhancements

1. **Collision Detection**: Warn users when uploading file with existing name
2. **Version History**: Keep multiple versions of same filename
3. **Folder Support**: Allow organizing attachments in subfolders
4. **Bulk Operations**: Download/delete multiple attachments
5. **Trash/Recycle**: Soft-delete with recovery option

## Documentation Updated

- ✅ `.specify/memory/specs/6-page-attachments/clarifications.md` - Updated GUID vs Filename section
- ✅ Created `ATTACHMENT-FILENAME-MIGRATION.md` (this file)

## Rollout Checklist

- [x] Backend types updated
- [x] Backend storage plugin updated
- [x] Backend Lambda handlers updated
- [x] Frontend types updated
- [x] Frontend hooks updated
- [x] Frontend components updated
- [x] Documentation updated
- [ ] Tests updated (in progress)
- [ ] Migration script created (if needed)
- [ ] API documentation updated
- [ ] User guide updated

## Questions & Answers

**Q: What happens if two users upload files with the same name simultaneously?**  
A: S3 is eventually consistent. Last write wins. Consider adding optimistic locking or version IDs if this is a concern.

**Q: What about files with Unicode characters in names?**  
A: The sanitization removes non-ASCII characters. Consider enhancing to support Unicode if needed.

**Q: Can we search attachments by filename now?**  
A: Yes! Since filename is the identifier, searching is straightforward.

**Q: What about very long filenames?**  
A: Sanitization limits to 255 characters, preserving extension.

## Conclusion

This migration significantly improves the attachment system's usability and debuggability. The change from opaque GUIDs to meaningful filenames makes the system more intuitive for both developers and end users.
