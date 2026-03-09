# Attachment Path Migration: Root to Page Folder

**Date**: 2026-03-09  
**Status**: ✅ Completed

## Overview

Migrated attachment storage from the page's root folder to the same directory as the page's .md file. This change provides better organization and consistency with the page structure.

## Motivation

**Before**: Attachments were stored at `{pageGuid}/_attachments/` (root of page's folder structure)  
**After**: Attachments stored at `{pageGuid}/{pageGuid}/_attachments/` (same folder as the .md file)

### Benefits

1. **Consistency**: Attachments are in the same folder as the page content (.md file)
2. **Better Organization**: All page-related files (content + attachments) are together
3. **Logical Structure**: Matches the S3 structure where pages are stored at `{guid}/{guid}.md`
4. **Easier Cleanup**: Deleting a page's folder removes everything related to it

## Page Structure

### S3 Storage Layout

Pages follow a hierarchical structure:
- Root page: `{guid}/{guid}.md`
- Child page: `{parent-guid}/{child-guid}/{child-guid}.md`
- Multi-level: `{grandparent-guid}/{parent-guid}/{child-guid}/{child-guid}.md`

### Before This Change

```
bluefinwiki-pages-bucket/
  page-abc/
    _attachments/              ← Attachments at root level
      photo.jpg
      photo.jpg.meta.json
      document.pdf
      document.pdf.meta.json
    page-abc.md                ← Page content in subfolder
```

### After This Change

```
bluefinwiki-pages-bucket/
  page-abc/
    page-abc/                  ← Page folder
      page-abc.md              ← Page content
      _attachments/            ← Attachments in same folder as .md
        photo.jpg
        photo.jpg.meta.json
        document.pdf
        document.pdf.meta.json
```

### For Child Pages

```
bluefinwiki-pages-bucket/
  parent-guid/
    child-guid/
      child-guid.md            ← Child page content
      _attachments/            ← Child page attachments
        image.png
        image.png.meta.json
```

## Changes Made

### Backend Changes

#### 1. S3StoragePlugin (`backend/src/storage/S3StoragePlugin.ts`)

**Added new helper method:**
```typescript
/**
 * Build the directory path where a page's attachments are stored
 * Returns path like: {parent-guid}/{guid}/_attachments/
 * For root pages: {guid}/{guid}/_attachments/
 * This ensures attachments are in the same folder as the page's .md file
 */
private async buildAttachmentPath(pageGuid: string): Promise<string> {
  const page = await this.loadPage(pageGuid);
  const pageKey = await this.buildPageKey(pageGuid, page.folderId || null);
  // Extract directory: "parent/child/child.md" -> "parent/child/"
  const directory = pageKey.substring(0, pageKey.lastIndexOf('/') + 1);
  return `${directory}_attachments/`;
}
```

**Updated methods:**
- `uploadAttachment()` - Changed from `${pageGuid}/_attachments/` to use `buildAttachmentPath()`
- `deleteAttachment()` - Changed from `${pageGuid}/_attachments/` to use `buildAttachmentPath()`
- `saveAttachmentMetadata()` - Changed from `${pageGuid}/_attachments/` to use `buildAttachmentPath()`
- `getAttachmentMetadata()` - Changed from `${pageGuid}/_attachments/` to use `buildAttachmentPath()`
- `listAttachments()` - Changed from `${pageGuid}/_attachments/` to use `buildAttachmentPath()`
- `getAttachmentUrl()` - Changed from `${pageGuid}/_attachments/` to use `buildAttachmentPath()`

#### 2. Updated Tests

All tests updated to expect the new path structure:
- `S3StoragePlugin.test.ts` - Updated unit test expectations
- `pages-attachments-storage.integration.test.ts` - Updated integration test paths
- `page-attachments.integration.test.ts` - Updated integration test expectations

#### 3. Updated Documentation

- `DATABASE-SCHEMA.md` - Updated S3 structure diagrams and access patterns
- `TASKS.md` - Updated task descriptions with new paths
- `ATTACHMENT-PATH-MIGRATION.md` - Created this migration document

## Migration Notes

⚠️ **Breaking Change**: This is a breaking change for existing deployments with attachments

### For Development/Testing Environments

**Option 1: Clear Existing Data** (Recommended for dev/test)
- Delete all pages and attachments
- Database will be reseeded with fresh data
- Run: `.\aspire\scripts\manage-seed-data.ps1 -Action export` to backup first (optional)
- Run: Clear S3 bucket and DynamoDB tables
- Run: `.\aspire\scripts\manage-seed-data.ps1 -Action import` to restore seed data

### For Production Environments

**Option 2: Migration Script** (Required for production)

Create and run a migration script to:
1. List all pages with attachments
2. For each page:
   - Get the page's folder path using `buildPageKey(guid, folderId)`
   - List all objects in old location: `{pageGuid}/_attachments/`
   - Copy each attachment to new location: `{pageGuid}/{pageGuid}/_attachments/`
   - Verify all files copied successfully
   - Delete old attachment files
3. Verify migration success

**Example migration pseudocode:**
```typescript
async function migrateAttachments() {
  const pages = await listAllPages();
  
  for (const page of pages) {
    const oldPrefix = `${page.guid}/_attachments/`;
    const newPrefix = await buildAttachmentPath(page.guid);
    
    // List all attachments in old location
    const objects = await s3.listObjectsV2({ Prefix: oldPrefix });
    
    for (const obj of objects.Contents) {
      const filename = obj.Key.replace(oldPrefix, '');
      const newKey = `${newPrefix}${filename}`;
      
      // Copy to new location
      await s3.copyObject({
        CopySource: `${bucket}/${obj.Key}`,
        Bucket: bucket,
        Key: newKey
      });
      
      // Verify copy succeeded
      await s3.headObject({ Bucket: bucket, Key: newKey });
      
      // Delete old file
      await s3.deleteObject({ Bucket: bucket, Key: obj.Key });
    }
    
    console.log(`Migrated attachments for page ${page.guid}`);
  }
}
```

⚠️ **Important**: Test the migration script on a backup/staging environment first!

## Verification

After applying changes:

1. **Run Tests**: All tests should pass
   ```bash
   cd backend
   npm test
   ```

2. **Upload New Attachment**: Should appear in new location
   - Create a test page
   - Upload an attachment
   - Verify in S3: `{pageGuid}/{pageGuid}/_attachments/{filename}`

3. **List Attachments**: Should show all attachments correctly
   - GET `/pages/{pageGuid}/attachments`
   - Should return metadata from `.meta.json` files

4. **Download Attachment**: Should generate correct presigned URLs
   - GET `/pages/{pageGuid}/attachments/{filename}`
   - URL should point to new location

## Rollback Plan

If issues arise, rollback steps:

1. Revert code changes:
   ```bash
   git revert <commit-hash>
   ```

2. For migrated production data:
   - Run reverse migration (copy from new location back to old location)
   - Verify all attachments accessible
   - Clean up new location files

## Testing Checklist

- [X] Unit tests updated and passing
- [X] Integration tests updated and passing
- [X] Documentation updated
- [X] Migration notes created
- [ ] Staging environment tested (if applicable)
- [ ] Production migration script created (if needed)
- [ ] Backup verified before production deployment

## Summary

This migration improves the logical organization of page-related files in S3 by keeping attachments in the same folder as the page content file. All attachment operations now use the new path structure, and comprehensive tests ensure the changes work correctly.

---

**Related Documents:**
- [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) - Updated S3 structure documentation
- [TASKS.md](TASKS.md) - Updated task descriptions
- [ATTACHMENT-FILENAME-MIGRATION.md](ATTACHMENT-FILENAME-MIGRATION.md) - Previous attachment migration
