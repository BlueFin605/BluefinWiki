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
- Is UUID v4 (random) definitely the right choice over UUID v7 (time-ordered)? use v7
- UUID v7 provides better S3 listing performance due to natural ordering
- How many retry attempts for collision detection before failing? we do not need collision detection
- Should collision tracking be logged/monitored? n/a
- What's the error message to user if GUID generation repeatedly fails? n/a

---

### 2. S3 Eventual Consistency Strategy
**Question**: How do we handle S3 eventual consistency issues in practice?

**Current spec says**: "System MUST handle S3 eventual consistency by using conditional writes for concurrent updates"

**Needs clarification**:
- What specific mechanism for conditional writes? (ETags, object versioning, DynamoDB locking?) ETags
- How long should the system retry after a write before confirming to user? 5 seconds
- What happens if a user creates a page but S3 replication hasn't completed when they try to view it? do not use s3 replication, s3 should be the source of truth, no need to replicate anywhere
- Should there be a "processing" indicator while waiting for consistency? without s3 replication do we need to worry about eventual consistency
- For folder listings, how do we handle cases where a just-created child doesn't appear yet? why would it now be available if there is no replication

---

### 3. Folder Structure for Root Pages
**Question**: How exactly are root-level pages stored in S3?

**Current spec says**: "System MUST support creating pages at root level (no parent) by storing in bucket root"

**Needs clarification**:
- Are root pages stored as `{guid}.md` directly in bucket root, or in a specific prefix like `pages/{guid}.md`? lets use `root/{guid}.md`
- If in bucket root, how do we separate pages from other S3 objects (attachments, metadata, system files)?
  - attachments prefix filename with 'attach' and the guid of the page the attachment is on e.g. attach-{guid}-{filename} 
- Should there be a `/pages/` prefix for all pages regardless of hierarchy level? yes
- How does CloudFront distinguish between page requests and attachment requests? 
  - page - pages/{guid}-page.md
  - attachment - pages/{guid}-attach-{filename}

---

### 4. Frontmatter vs. Folder Metadata Files
**Question**: When do we use page frontmatter vs. separate `_folder.yml` files?

**Current spec mentions both**: Pages have frontmatter with `parent` field, AND folders have `_folder.yml` metadata files.

**Needs clarification**:
- Is `_folder.yml` only created when a page has children, or always for every page? always
- Does `_folder.yml` duplicate information that's in the parent page's frontmatter? no let it inherit from it's parent, especially state so when you delete a folder all children inherit the 'deleted' state
- If a "folder" is just a page with children, why do we need separate folder metadata? where do we store the display name of the folder if the folder is a guid
- Should we consolidate to: pages have frontmatter, and folder display names come from parent page frontmatter? no
- Or should folders be truly separate entities with their own metadata files? seperate entities and the meta data stores thigns like dispay name and state (we may want to be able to delete a folder)

---

### 5. Page Move Atomicity
**Question**: How do we ensure page moves are atomic to prevent data loss?

**Current spec says**: "Given a page move in progress, when the copy succeeds but delete fails, then system logs the inconsistency..."

**clarification**
not sure it should be atomic - we need to recursively walk the tree and move all object to the new folder, once that is complete mark the folder that was moved as deleted in meta data. While that is happening some objects will be in the old location and some will be in new, and the user will be able to observe this state. if something goes wronmg they can retry or fix it themselves

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
- If page GUID is `abc-123` and attachment filename is `def456`, and the olderpath is folder1/folder2/folder3 the full S3 keys are: 
    page is : pages/folder1-guid/folder2-guid/folder3-guid/abc-123-page.md
    attachment is pages/folder1-guid/folder2-guid/folder3-guid/abc-123-attach-def456.jpg`?
- How do attachments work for root-level pages? the same except it is just under pages and there are no folders
- Are attachment metadata files stored as `def-456.meta.json` in the same `_attachments` folder? is there a need for meta adat for attachments
- How are attachment URLs generated for CloudFront access?

**clarification**
 attachments are stored alongside the page and do not use a GUID, insteads a composite key of the page guid and attachment name is made/ i.e. pages/folder path/{guid}-attach-{filename}
---

### 7. Frontmatter Schema Definition
**Question**: What is the complete and required frontmatter schema?

**Current spec lists**: "title, parent, created, modified, author"

**Needs clarification**:
- Which fields are absolutely required vs optional? title, created, modified, author are required. parent not needed as hierarchy is defined by folder structure
- What's the exact YAML structure? Is `parent` a string GUID or an object? parent not needed as hierarchy is defined by folder structure
- Example: `parent: "abc-123"` or `parent: { id: "abc-123", title: "Parent Page" }`? `parent: { id: "abc-123", title: "Parent Page" }`
- Should `author` be user ID (GUID) or username/email? username\email
- Are `created` and `modified` ISO 8601 timestamps? yes
- Should there be version tracking in frontmatter (version number)? yes
- What about optional fields like tags, description, permissions? yes
** clarification**
- pages use Frontmatter
- folders have a seperate metadata file

---

### 8. Display Name to GUID Resolution
**Question**: How does the system resolve display names to GUIDs for lookups?

**ANSWERED**: Using pluggable URL mapping service

**Implementation**:
- **URL Mapping Service** (pluggable interface for different cloud providers)
- Maps: `short-code-guid → { s3Path, pageTitle, folderPath, status, permissions }`
- Reverse lookup: `s3Path → short-code-guid`
- Display name stored in page frontmatter
- URL format: `/pages/{short-code}/Page Title`
- Short-code provides stable identifier (never changes)
- Page title in URL is cosmetic/SEO (can differ from actual title)
- Mapping updated on:
  - Page create: Add new short-code mapping
  - Page rename: Update pageTitle field
  - Page move: Update s3Path field  
  - Page delete: Update status to 'deleted'
- No complex caching needed - mapping is lightweight metadata
---

### NEW: URL Mapping Service Interface
**Question**: What is the interface for the pluggable URL mapping service?

**ANSWERED**: Pluggable interface design for cloud-agnostic implementation

**Interface Definition**:
```typescript
interface IUrlMappingService {
  // Create new short-code mapping
  createMapping(pageGuid: string, s3Path: string, pageTitle: string): Promise<string>; // returns short-code
  
  // Resolve short-code to page metadata
  resolveShortCode(shortCode: string): Promise<PageUrlMapping>;
  
  // Update mapping on page operations
  updateTitle(shortCode: string, newTitle: string): Promise<void>;
  updatePath(shortCode: string, newS3Path: string): Promise<void>;
  markDeleted(shortCode: string): Promise<void>;
  
  // Reverse lookup (optional, for admin tools)
  findByS3Path(s3Path: string): Promise<string>; // returns short-code
}

interface PageUrlMapping {
  shortCode: string;
  pageGuid: string;
  s3Path: string;
  pageTitle: string;
  status: 'active' | 'deleted';
  lastModified: Date;
}
```

**Implementation Options**:
- DynamoDB (AWS)
- Cosmos DB (Azure)
- Firestore (GCP)
- PostgreSQL (self-hosted)
- Any key-value store with fast lookups

**Performance Requirements**:
- < 50ms lookup latency for short-code resolution
- Strongly consistent reads (not eventual)
- Indexed on short-code (primary key)
- Optional index on s3Path for reverse lookup

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

**clarification**
- if we want versioning, then attach a sufix to the end of s3 filename such as 'ver-{verno}'
---

### 10. Recursive Child Moves
**Question**: How are child pages and nested folders handled during parent moves?

**Current spec says**: "System MUST recursively move children when a parent page is moved"

**Needs clarification**:
- For a parent with 50 child pages, do we move each file individually (50 copy+delete operations)? you need to move eash file to new structure individually
- Or does S3 have a more efficient "move folder" operation? no
- How do we show progress to the user during large moves? don't chnages will show up in ui as they move one by one - but we don;t push changes to client 
- What happens if move fails halfway through? Rollback all or leave partial state? leave partial state, it can recover by retrying
- Should there be a confirmation prompt showing number of affected pages before moving? nope

---

### 11. Circular Reference Prevention
**Question**: How exactly do we prevent circular references during moves?

**Current spec says**: "System MUST prevent circular hierarchy references during move operations"

**Needs clarification**:
- What algorithm checks for circular references? Traverse parent chain? if you are using a folder structure in S3 then as long as the source and dest folders are different you should not have an issue. But you annot move a folder to a child folder though
- At what point is validation performed - before starting move or during?
- Specific error message: "Cannot move page to its own child" or more detailed?
- Does this validation happen client-side, server-side, or both?

---

### 12. Soft Delete vs Hard Delete
**Question**: Is page deletion soft (move to trash) or hard (permanent removal)? soft, use a status in meta data

**Current spec says**: "System MUST delete or move to trash prefix (`_trash/`) when pages are deleted"

**Needs clarification**:
- Is this a configuration option or user choice at delete time? configuration
- If soft delete, how long do files remain in `_trash/` before permanent removal? permanantly
- Can users recover pages from trash themselves, or only admins? admins, for now
- Does trash count toward S3 storage costs (should users be warned)? yes
- Should there be a "Empty Trash" function? no

**claification**
- there is not _trash/ folder, instead there is a status in meata data for each page, one os which could be deleted

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

**clarification**
- if pages and folders have metadatra that inherits down the tree, simply marking the folder as deleted should delete all child pages and folders as they inherit from the parent
---

### 14. Content Type and Metadata Headers
**Question**: What S3 object metadata should be set for pages and attachments?

**Current spec says**: "System MUST use S3 object metadata for content-type, cache-control, and last-modified headers"

**Needs clarification**:
- Exact `Content-Type` for markdown files: `text/markdown` or `text/plain`? `text/markdown`
- What `Cache-Control` values? `max-age=3600`? `must-revalidate`? usew both together 'Cache-Control: max-age=3600, must-revalidate'
- Should `Content-Disposition` be set? If so, to what? use inline
- What custom metadata should we store (author, version, page-title)? metadata should be in frontmatter
- Are there S3 metadata limits we should be aware of? do not use s3 metadata

---

### 15. Large Folder Listing Performance
**Question**: How do we handle folders with hundreds of children?

**Current spec mentions**: "Given a parent with many children (100+), when listing children, then the system efficiently handles pagination using S3 list pagination"

**Needs clarification**:
- What's the page size for S3 ListObjectsV2? 1000 (max) or smaller?
- Should UI paginate results (show 25 at a time) or load all and paginate client-side? paginate result
- How do we sort by display name if frontmatter must be fetched for each page? maybe we do need folder meta data that allows to hold sort order of a page
- Should we fetch all frontmatter or use DynamoDB cache for folder listings? frontmatter
- At what scale does performance become unacceptable (500? 1000? 5000 pages)? let' go unlimite and solve it when we know when it is too big

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Special Characters in Display Names
**Question**: How are special characters and spaces in display names handled?

**Current spec says**: "System URL-encodes display names for paths while keeping GUIDs for actual S3 operations"

**Needs clarification**:
- Should certain characters be forbidden in display names (/, \\, <, >, etc.)? no
- How are emojis handled in display names? display them
- Example URL: `/wiki/Projects/Project%20Alpha` or `/wiki/abc-123`? `/wiki/Projects/Project%20Alpha`
- Should there be URL slug generation (e.g., "Project Alpha" → "project-alpha")? no
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
- Is this structure accurate? close, no _trash required
- Should there be a `/pages/` prefix or are pages at root? pages
- Where do system files (config, templates, etc.) go? in '/system/'

---

### 18. CloudFront Integration
**Question**: How does CloudFront serve pages and attachments from S3?

**Current spec mentions**: "System MUST configure S3 bucket with appropriate CORS settings for CloudFront access"

**Needs clarification**:
- What specific CORS settings are needed?
  - AllowedOrigins: Your CloudFront distribution domain
  - AllowedMethods: GET for reads, PUT for uploads, DELETE for deletions
  - ExposeHeaders: ETag for conditional writes, Content-Length for progress tracking
  - MaxAgeSeconds: Cache CORS preflight for 1 hour
- Should S3 bucket be private with CloudFront OAI/OAC?
   - Use CloudFront with Origin Access Control (OAC):
   - S3 bucket should be private (block all public access)
   - CloudFront OAC grants CloudFront permission to access S3
   - Users access content through CloudFront URL only
   - This prevents direct S3 access and enables caching/security features
- How are dynamic pages served vs static attachments? same way
- Is there server-side rendering of markdown, or is markdown sent to browser for client-side rendering? client-side
- What's cached in CloudFront (attachments only, or rendered pages too)? attachments and rendered pages

---

### 19. Malformed Frontmatter Handling
**Question**: What's the specific behavior when frontmatter is malformed?

**Current spec says**: "System attempts to parse, falls back to treating entire content as body, and logs a warning for admin review"

**Needs clarification**:
- Does the page still display to users if frontmatter is broken? yes
- What temporary values are used (title = filename? created = current time?)? yes
- Is there a UI indicator that frontmatter is malformed? yes
- Can users edit and fix the frontmatter through the editor? edit the title
- Should editor validate frontmatter before save? yes

---

### 20. Parent Reference Consistency
**Question**: How do we ensure parent references in frontmatter stay consistent?

**Needs clarification**:
- When a page is moved, do we update the `parent` field in frontmatter? no parent field in frontmatter
- Or is parent relationship determined by S3 folder structure alone?
- If both, which is source of truth?
- What if frontmatter `parent` doesn't match S3 folder structure?
- Should there be a consistency check/repair tool?

---

### 21. Attachment Original Filename Storage
**Question**: Where exactly is the original filename stored for attachments?

**Current spec says**: "System MUST store attachment metadata in sidecar JSON files (original filename, upload date, content type)"

**Needs clarification**:
- Is the sidecar file named `{attachment-guid}.meta.json`? not sure we need attachment meta data
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
- Specific error messages for different scenarios? generic
  - "Unable to save page. Please try again." (generic)
  - "Storage service unavailable. Your changes are saved locally." (with local backup)
  - "Network error. Please check your connection." (connectivity issue)
- Should unsaved content be preserved in browser storage? no
- Auto-retry mechanism? no - user can retry themselves

---

### 23. Multi-Page Operations
**Question**: Can users perform bulk operations on multiple pages? no

**Not explicitly covered in spec**:
- Can users select multiple pages and move them all at once?
- Can users bulk-delete multiple pages?
- If so, how does the UI show progress/failures for batch operations?
- Should there be an "undo" for bulk operations?

---

### 24. Page Access Permissions
**Question**: Does the S3 storage plugin handle page-level permissions? no

**Not explicitly covered in spec**:
- Are all pages accessible to all authenticated users?
- Or can pages have view/edit restrictions?
- If so, where is permission metadata stored?
- Is this the storage plugin's responsibility or handled at application layer?

---

### 25. Backup and Export
**Question**: How can admins backup or export all wiki content from S3? not needed

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
