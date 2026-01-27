# Clarification Questions: S3 Storage Plugin

**Feature**: S3 Storage Plugin for Wiki Pages  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. GUID Generation and Collision Handling
**Question**: What UUID version should be used, and how certain should we be about collision handling?

**Current spec says**: "System MUST use UUID v4 format for all GUIDs to ensure uniqueness"

**Needs clarification**:
- Is UUID v4 (random) definitely the right choice over UUID v7 (time-ordered)?
- UUID v7 provides better S3 listing performance due to natural ordering
- How many retry attempts for collision detection before failing?
- Should collision tracking be logged/monitored?
- What's the error message to user if GUID generation repeatedly fails?

---

### 2. S3 Eventual Consistency Strategy
**Question**: How do we handle S3 eventual consistency issues in practice?

**Current spec says**: "System MUST handle S3 eventual consistency by using conditional writes for concurrent updates"

**Needs clarification**:
- What specific mechanism for conditional writes? (ETags, object versioning, DynamoDB locking?)
- How long should the system retry after a write before confirming to user?
- What happens if a user creates a page but S3 replication hasn't completed when they try to view it?
- Should there be a "processing" indicator while waiting for consistency?
- For folder listings, how do we handle cases where a just-created child doesn't appear yet?

---

### 3. Folder Structure for Root Pages
**Question**: How exactly are root-level pages stored in S3?

**Current spec says**: "System MUST support creating pages at root level (no parent) by storing in bucket root"

**Needs clarification**:
- Are root pages stored as `{guid}.md` directly in bucket root, or in a specific prefix like `pages/{guid}.md`?
- If in bucket root, how do we separate pages from other S3 objects (attachments, metadata, system files)?
- Should there be a `/pages/` prefix for all pages regardless of hierarchy level?
- How does CloudFront distinguish between page requests and attachment requests?

---

### 4. Frontmatter vs. Folder Metadata Files
**Question**: When do we use page frontmatter vs. separate `_folder.yml` files?

**Current spec mentions both**: Pages have frontmatter with `parent` field, AND folders have `_folder.yml` metadata files.

**Needs clarification**:
- Is `_folder.yml` only created when a page has children, or always for every page?
- Does `_folder.yml` duplicate information that's in the parent page's frontmatter?
- If a "folder" is just a page with children, why do we need separate folder metadata?
- Should we consolidate to: pages have frontmatter, and folder display names come from parent page frontmatter?
- Or should folders be truly separate entities with their own metadata files?

---

### 5. Page Move Atomicity
**Question**: How do we ensure page moves are atomic to prevent data loss?

**Current spec says**: "Given a page move in progress, when the copy succeeds but delete fails, then system logs the inconsistency..."

**Needs clarification**:
- What's the actual recovery strategy? Admin manual cleanup? Automatic retry?
- Should moves use a two-phase commit pattern with temporary "moving" marker?
- How long are duplicate pages tolerated before requiring resolution?
- Should there be a background job that detects and cleans up failed moves?
- What if user tries to edit the page while a move is in progress?

---

## 🟡 High Priority - Important for User Experience

### 6. Attachment Storage Structure
**Question**: What exactly is the attachment storage path and naming convention?

**Current spec says**: "System MUST store attachments in `<page-guid>/_attachments/<attachment-guid>.<ext>` structure"

**Needs clarification**:
- If page GUID is `abc-123` and attachment GUID is `def-456`, is the full S3 key: `abc-123/_attachments/def-456.jpg`?
- Or is it: `pages/abc-123/_attachments/def-456.jpg` (with pages prefix)?
- How do attachments work for root-level pages?
- Are attachment metadata files stored as `def-456.meta.json` in the same `_attachments` folder?
- How are attachment URLs generated for CloudFront access?

---

### 7. Frontmatter Schema Definition
**Question**: What is the complete and required frontmatter schema?

**Current spec lists**: "title, parent, created, modified, author"

**Needs clarification**:
- Which fields are absolutely required vs optional?
- What's the exact YAML structure? Is `parent` a string GUID or an object?
- Example: `parent: "abc-123"` or `parent: { id: "abc-123", title: "Parent Page" }`?
- Should `author` be user ID (GUID) or username/email?
- Are `created` and `modified` ISO 8601 timestamps?
- Should there be version tracking in frontmatter (version number)?
- What about optional fields like tags, description, permissions?

---

### 8. Display Name to GUID Resolution
**Question**: How does the system resolve display names to GUIDs for lookups?

**Current spec says**: "System MUST maintain a mapping cache (DynamoDB) for display name to GUID resolution for performance"

**Needs clarification**:
- Is DynamoDB cache mandatory or optional for S3 plugin?
- If optional, what's the fallback? Scan all S3 objects and parse frontmatter?
- How is the cache invalidated/updated when pages are renamed?
- Is the cache indexed by full path (e.g., "Projects/Alpha") or just page title?
- What happens if cache is stale or unavailable?
- Should URL paths use slugified display names or always use GUIDs?

---

### 9. S3 Versioning Configuration
**Question**: Is S3 versioning required, optional, or configured at deployment?

**Current spec says**: "System MUST support S3 versioning for page history (optional, best-effort per interface)"

**Needs clarification**:
- "Optional" vs "best-effort" - what does this mean exactly?
- Should the system check if versioning is enabled and adjust behavior?
- If versioning is disabled, does page history feature simply not work?
- Or do we maintain explicit version files (e.g., `{guid}/v1.md`, `{guid}/v2.md`)?
- How does this interact with the page history feature (spec #9)?

---

### 10. Recursive Child Moves
**Question**: How are child pages and nested folders handled during parent moves?

**Current spec says**: "System MUST recursively move children when a parent page is moved"

**Needs clarification**:
- For a parent with 50 child pages, do we move each file individually (50 copy+delete operations)?
- Or does S3 have a more efficient "move folder" operation?
- How do we show progress to the user during large moves?
- What happens if move fails halfway through? Rollback all or leave partial state?
- Should there be a confirmation prompt showing number of affected pages before moving?

---

### 11. Circular Reference Prevention
**Question**: How exactly do we prevent circular references during moves?

**Current spec says**: "System MUST prevent circular hierarchy references during move operations"

**Needs clarification**:
- What algorithm checks for circular references? Traverse parent chain?
- At what point is validation performed - before starting move or during?
- Specific error message: "Cannot move page to its own child" or more detailed?
- Does this validation happen client-side, server-side, or both?

---

### 12. Soft Delete vs Hard Delete
**Question**: Is page deletion soft (move to trash) or hard (permanent removal)?

**Current spec says**: "System MUST delete or move to trash prefix (`_trash/`) when pages are deleted"

**Needs clarification**:
- Is this a configuration option or user choice at delete time?
- If soft delete, how long do files remain in `_trash/` before permanent removal?
- Can users recover pages from trash themselves, or only admins?
- Does trash count toward S3 storage costs (should users be warned)?
- Should there be a "Empty Trash" function?

---

### 13. Multiple Children Deletion
**Question**: What happens when deleting a parent that has children?

**Current spec says**: "System either prevents deletion with an error or recursively deletes all children (based on configuration)"

**Needs clarification**:
- What is the DEFAULT behavior? Prevent or recursive delete?
- Should there be a user prompt: "Delete page and X children?" with checkbox confirmation?
- If prevent mode, what's the workflow to delete? Must delete children first?
- If recursive mode, how deep does it go? Any limit?
- Are all deleted children logged for potential recovery?

---

### 14. Content Type and Metadata Headers
**Question**: What S3 object metadata should be set for pages and attachments?

**Current spec says**: "System MUST use S3 object metadata for content-type, cache-control, and last-modified headers"

**Needs clarification**:
- Exact `Content-Type` for markdown files: `text/markdown` or `text/plain`?
- What `Cache-Control` values? `max-age=3600`? `must-revalidate`?
- Should `Content-Disposition` be set? If so, to what?
- What custom metadata should we store (author, version, page-title)?
- Are there S3 metadata limits we should be aware of?

---

### 15. Large Folder Listing Performance
**Question**: How do we handle folders with hundreds of children?

**Current spec mentions**: "Given a parent with many children (100+), when listing children, then the system efficiently handles pagination using S3 list pagination"

**Needs clarification**:
- What's the page size for S3 ListObjectsV2? 1000 (max) or smaller?
- Should UI paginate results (show 25 at a time) or load all and paginate client-side?
- How do we sort by display name if frontmatter must be fetched for each page?
- Should we fetch all frontmatter or use DynamoDB cache for folder listings?
- At what scale does performance become unacceptable (500? 1000? 5000 pages)?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Special Characters in Display Names
**Question**: How are special characters and spaces in display names handled?

**Current spec says**: "System URL-encodes display names for paths while keeping GUIDs for actual S3 operations"

**Needs clarification**:
- Should certain characters be forbidden in display names (/, \\, <, >, etc.)?
- How are emojis handled in display names?
- Example URL: `/wiki/Projects/Project%20Alpha` or `/wiki/abc-123`?
- Should there be URL slug generation (e.g., "Project Alpha" → "project-alpha")?
- Do slugs need to be unique, or can multiple pages have same slug (differentiated by parent path)?

---

### 17. S3 Bucket Organization
**Question**: What's the complete S3 bucket structure and organization?

**Needs definition**:
```
my-wiki-bucket/
  ├── pages/
  │   ├── {root-page-guid}.md
  │   ├── {parent-guid}/
  │   │   ├── _folder.yml
  │   │   ├── {child-guid}.md
  │   │   └── {child-guid}/
  │   │       └── _attachments/
  │   │           └── {attachment-guid}.jpg
  │   └── ...
  ├── _trash/
  │   └── {deleted-guid}.md
  └── _system/
      └── config.json
```
- Is this structure accurate?
- Should there be a `/pages/` prefix or are pages at root?
- Where do system files (config, templates, etc.) go?

---

### 18. CloudFront Integration
**Question**: How does CloudFront serve pages and attachments from S3?

**Current spec mentions**: "System MUST configure S3 bucket with appropriate CORS settings for CloudFront access"

**Needs clarification**:
- What specific CORS settings are needed?
- Should S3 bucket be private with CloudFront OAI/OAC?
- How are dynamic pages served vs static attachments?
- Is there server-side rendering of markdown, or is markdown sent to browser for client-side rendering?
- What's cached in CloudFront (attachments only, or rendered pages too)?

---

### 19. Malformed Frontmatter Handling
**Question**: What's the specific behavior when frontmatter is malformed?

**Current spec says**: "System attempts to parse, falls back to treating entire content as body, and logs a warning for admin review"

**Needs clarification**:
- Does the page still display to users if frontmatter is broken?
- What temporary values are used (title = filename? created = current time?)?
- Is there a UI indicator that frontmatter is malformed?
- Can users edit and fix the frontmatter through the editor?
- Should editor validate frontmatter before save?

---

### 20. Parent Reference Consistency
**Question**: How do we ensure parent references in frontmatter stay consistent?

**Needs clarification**:
- When a page is moved, do we update the `parent` field in frontmatter?
- Or is parent relationship determined by S3 folder structure alone?
- If both, which is source of truth?
- What if frontmatter `parent` doesn't match S3 folder structure?
- Should there be a consistency check/repair tool?

---

### 21. Attachment Original Filename Storage
**Question**: Where exactly is the original filename stored for attachments?

**Current spec says**: "System MUST store attachment metadata in sidecar JSON files (original filename, upload date, content type)"

**Needs clarification**:
- Is the sidecar file named `{attachment-guid}.meta.json`?
- Complete schema example needed:
```json
{
  "id": "def-456",
  "originalFilename": "family-photo.jpg",
  "contentType": "image/jpeg",
  "size": 2453876,
  "uploadedAt": "2026-01-13T10:30:00Z",
  "uploadedBy": "user-guid-789"
}
```
- Is this correct?

---

### 22. S3 Write Failure User Experience
**Question**: What does the user see when S3 write operations fail?

**Current spec says**: "System returns an error to user, page changes are not saved"

**Needs clarification**:
- Specific error messages for different scenarios?
  - "Unable to save page. Please try again." (generic)
  - "Storage service unavailable. Your changes are saved locally." (with local backup)
  - "Network error. Please check your connection." (connectivity issue)
- Should unsaved content be preserved in browser storage?
- Auto-retry mechanism?

---

### 23. Multi-Page Operations
**Question**: Can users perform bulk operations on multiple pages?

**Not explicitly covered in spec**:
- Can users select multiple pages and move them all at once?
- Can users bulk-delete multiple pages?
- If so, how does the UI show progress/failures for batch operations?
- Should there be an "undo" for bulk operations?

---

### 24. Page Access Permissions
**Question**: Does the S3 storage plugin handle page-level permissions?

**Not explicitly covered in spec**:
- Are all pages accessible to all authenticated users?
- Or can pages have view/edit restrictions?
- If so, where is permission metadata stored?
- Is this the storage plugin's responsibility or handled at application layer?

---

### 25. Backup and Export
**Question**: How can admins backup or export all wiki content from S3?

**Not explicitly covered in spec**:
- Is there an export function to download all pages as a ZIP?
- Can admins use AWS S3 sync/backup directly?
- Should there be scheduled backups to another S3 bucket?
- What's the disaster recovery story?

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - these affect core architecture and data model
2. **Create a detailed data model document** showing exact S3 structure, frontmatter schema, and metadata formats
3. **Consider prototyping the GUID resolution and caching strategy** - this is performance-critical
4. **Clarify the relationship between page frontmatter and folder metadata files** - there seems to be overlap

Would you like me to:
- Help answer any of these questions?
- Create a sample data model document?
- Design the GUID resolution and caching strategy?
