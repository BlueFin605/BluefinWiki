# Feature Specification: S3 Storage Plugin for Wiki Pages

**Feature Branch**: `2-s3-storage-plugin`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Implement S3 storage plugin for wiki pages. This storage also manages the parent-child page relationships using the S3 folder structure. To allow renaming of pages and folders they should be named by GUID's. The display names should be stored as meta data in the .md file or a special file in each folder storing meta data for the folder"

## Cross-References

**Core dependency for:**
- [4-page-editor.md](4-page-editor.md) - All page content saved to S3
- [3-folder-management.md](3-folder-management.md) - Folder structure managed in S3
- [9-page-history.md](9-page-history.md) - Version files stored in S3 with explicit naming convention
- [6-page-attachments.md](6-page-attachments.md) - Attachment files stored in S3
- [14-export-functionality.md](14-export-functionality.md) - Temporary export files stored in S3

**Monitored by:**
- [17-admin-configuration.md](17-admin-configuration.md) - US-12.5 system health monitoring
- [19-error-handling-edge-cases.md](19-error-handling-edge-cases.md) - Story 1 handles S3 outages

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create New Wiki Page (Priority: P1)

A user creates a new wiki page, which is stored in S3 as a markdown file with a GUID-based filename and the page's display name stored in YAML frontmatter.

**Why this priority**: This is the fundamental operation for any wiki. Without the ability to create pages, the wiki cannot function. This is the MVP requirement.

**Independent Test**: Create a new page with title "Getting Started", verify it appears in the wiki with correct title, then check S3 directly to confirm a GUID-named .md file exists with proper frontmatter containing the display name.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they create a new page with title "Getting Started" and content "Welcome to our wiki", **Then** an S3 object is created with GUID filename (e.g., `a1b2c3d4.md`) and the frontmatter contains `title: "Getting Started"`
2. **Given** a new page is created, **When** the page is stored in S3, **Then** the S3 object metadata includes content-type `text/markdown` and last-modified timestamp
3. **Given** a page creation request, **When** the GUID is generated, **Then** it is guaranteed to be unique within the S3 bucket namespace
4. **Given** a page with markdown content including headings and lists, **When** it is saved to S3, **Then** the content is stored exactly as provided without modification
5. **Given** a new page is created as a root-level page, **When** stored in S3, **Then** it is placed in the bucket root with no parent folder

---

### User Story 2 - Create Child Pages in Hierarchy (Priority: P1)

A user creates a child page under an existing parent page, which is stored in S3 using a folder structure where the parent's GUID becomes a folder containing the child's GUID-named file.

**Why this priority**: Hierarchical organization is a non-negotiable constitutional requirement (Principle #4). Without this, the wiki violates its core principles.

**Independent Test**: Create a parent page "Projects", then create a child page "Project Alpha" under it, verify the hierarchy displays correctly in the wiki, and confirm in S3 that the child file exists at path `<parent-guid>/<child-guid>.md`.

**Acceptance Scenarios**:

1. **Given** a parent page with GUID `abc123` exists, **When** a child page "Project Alpha" is created under it, **Then** the child file is stored at S3 path `abc123/def456.md` where `def456` is the child's GUID
2. **Given** a child page is created, **When** stored in S3, **Then** its frontmatter includes `parent: "abc123"` referencing the parent's GUID
3. **Given** a parent with multiple children, **When** retrieving the parent's children, **Then** all child files within the parent's GUID folder are returned in alphabetical order by display name
4. **Given** a child page under a parent, **When** the parent-child relationship is established, **Then** the folder structure reflects the hierarchy (folder = parent, file inside = child)
5. **Given** a deeply nested hierarchy (grandparent/parent/child), **When** creating the child, **Then** the S3 path is `grandparent-guid/parent-guid/child-guid.md` reflecting the full hierarchy

---

### User Story 3 - Read and Display Wiki Pages (Priority: P1)

A user views a wiki page by its display name or path, and the system retrieves it from S3 by resolving the display name to the GUID, then loading the markdown content.

**Why this priority**: Reading content is essential functionality. Without this, created pages cannot be viewed, making the wiki useless.

**Independent Test**: Create a page "Documentation" with specific content, navigate to it in the wiki UI, and verify the correct title and content are displayed by retrieving from S3 using the GUID.

**Acceptance Scenarios**:

1. **Given** a page with GUID `xyz789` and display name "Documentation" exists, **When** a user requests the page by path `/wiki/documentation`, **Then** the system resolves the display name to GUID and retrieves `xyz789.md` from S3
2. **Given** a page is retrieved from S3, **When** the content is loaded, **Then** the YAML frontmatter is parsed separately from the markdown body content
3. **Given** a page with frontmatter and markdown content, **When** displayed to user, **Then** the title from frontmatter is shown as the page heading and the markdown is rendered as HTML
4. **Given** a page that doesn't exist, **When** a user tries to access it, **Then** the system returns a clear "Page Not Found" error without exposing S3 details
5. **Given** a child page at path `/wiki/projects/project-alpha`, **When** requested, **Then** the system resolves both parent and child display names to GUIDs and retrieves from correct S3 path

---

### User Story 4 - Update Existing Wiki Pages (Priority: P1)

A user edits an existing wiki page, updating its content or metadata, and the changes are saved back to S3 at the same GUID-based location preserving the filename.

**Why this priority**: Content editing is a core wiki function. This completes the essential CRUD operations needed for a functional wiki.

**Independent Test**: Edit an existing page's content and title, save changes, refresh the page, and verify both content and title updates are persisted in S3 and displayed correctly.

**Acceptance Scenarios**:

1. **Given** a page with GUID `abc123` exists, **When** a user updates the content, **Then** the same S3 object `abc123.md` is overwritten with the new content
2. **Given** a page update, **When** saved to S3, **Then** the frontmatter `modified` timestamp is updated to the current time
3. **Given** a page update, **When** S3 versioning is enabled, **Then** the previous version is preserved and accessible via S3 version history
4. **Given** a page with title "Old Title", **When** the title is changed to "New Title", **Then** the frontmatter is updated but the GUID filename remains unchanged
5. **Given** a page update in progress, **When** another user tries to update simultaneously, **Then** the system handles the conflict gracefully (last-write-wins with S3 conditional writes)

---

### User Story 5 - Rename Pages and Folders (Priority: P1)

A user renames a page or parent folder, which updates the display name in the frontmatter or folder metadata file without changing the GUID-based S3 structure, preserving all references and child relationships.

**Why this priority**: The GUID-based naming system's primary benefit is enabling renames without breaking links. This is a key architectural requirement that validates the design choice.

**Independent Test**: Create a page "Original Name" with children, rename it to "New Name", verify the hierarchy remains intact, all child pages still work, and the S3 GUID structure is unchanged.

**Acceptance Scenarios**:

1. **Given** a page with GUID `abc123` and display name "Original Name", **When** renamed to "New Name", **Then** only the frontmatter `title` field is updated to "New Name" and the filename remains `abc123.md`
2. **Given** a parent folder with children, **When** the parent is renamed, **Then** all child pages remain at the same S3 paths and parent-child relationships are preserved
3. **Given** a folder containing multiple pages, **When** the folder is renamed, **Then** a folder metadata file (e.g., `_folder.yml`) is updated with the new display name
4. **Given** a page is renamed, **When** other pages link to it by GUID reference, **Then** all links continue to work without updates (GUID-based linking)
5. **Given** a deeply nested page is renamed, **When** the rename completes, **Then** the full hierarchical path reflects the new name while S3 structure remains unchanged

---

### User Story 6 - Move Pages in Hierarchy (Priority: P2)

A user moves a page from one parent to another (or to root level), which relocates the page's file in S3 from one folder to another and updates the parent reference in frontmatter.

**Why this priority**: Reorganizing content is important for wiki maintenance but not essential for initial functionality. Users can work around this by copying content to a new page.

**Independent Test**: Create a page under parent "A", move it to parent "B", verify it now appears under "B" in the hierarchy, and confirm in S3 that the file moved from `A-guid/page-guid.md` to `B-guid/page-guid.md`.

**Acceptance Scenarios**:

1. **Given** a page at `parentA-guid/page-guid.md`, **When** moved to parent B, **Then** the S3 object is copied to `parentB-guid/page-guid.md` and the original is deleted
2. **Given** a page move operation, **When** the move completes, **Then** the frontmatter `parent` field is updated to reference the new parent's GUID
3. **Given** a page with children is moved, **When** the move operation executes, **Then** all children move with the parent maintaining the relative hierarchy
4. **Given** a child page is moved to root level, **When** the move completes, **Then** the file is relocated to bucket root and the `parent` field is removed from frontmatter
5. **Given** a page move in progress, **When** the copy succeeds but delete fails, **Then** the system detects the duplicate and completes the cleanup or rolls back

---

### User Story 7 - Delete Wiki Pages (Priority: P2)

A user deletes a wiki page, which removes the markdown file from S3 (or moves it to a "trash" prefix if soft-delete is enabled), and the page no longer appears in the wiki.

**Why this priority**: Deletion is important for content management but not essential for initial launch. Users can work around by unpublishing or moving unwanted pages.

**Independent Test**: Create a page, delete it, verify it no longer appears in wiki navigation or search, and confirm the S3 object is either deleted or moved to a trash location.

**Acceptance Scenarios**:

1. **Given** a page with GUID `abc123` exists, **When** a user deletes it, **Then** the S3 object `abc123.md` is deleted (or moved to `_trash/abc123.md` for soft-delete)
2. **Given** a parent page with children, **When** the parent is deleted, **Then** the system either prevents deletion with an error or recursively deletes all children (based on configuration)
3. **Given** a deleted page, **When** S3 versioning is enabled, **Then** the deletion is recorded as a delete marker in version history allowing potential recovery
4. **Given** a soft-deleted page, **When** moved to trash, **Then** the system maintains a trash index for potential restoration
5. **Given** a page deletion, **When** completed, **Then** any internal links to the deleted page show as broken links with clear indication

---

### User Story 8 - List Children and Navigate Hierarchy (Priority: P1)

A user views a parent page and sees a list of all child pages, or navigates the wiki tree structure, which queries S3 to find all files within a parent's GUID folder.

**Why this priority**: Navigating the hierarchy is essential for a hierarchical wiki. Without this, users cannot discover or access child pages.

**Independent Test**: Create a parent with 5 children, view the parent page, and verify all 5 children are listed in correct order by display name retrieved from their frontmatter.

**Acceptance Scenarios**:

1. **Given** a parent with GUID `abc123` has 5 children, **When** listing children, **Then** S3 is queried for all objects with prefix `abc123/` and all `.md` files are returned
2. **Given** child pages are retrieved, **When** displaying the list, **Then** pages are sorted alphabetically by display name (extracted from frontmatter), not by GUID
3. **Given** a folder with both pages and subfolders, **When** listing contents, **Then** subfolders (identified by `_folder.yml` presence) are distinguished from pages
4. **Given** a deeply nested hierarchy, **When** generating breadcrumb navigation, **Then** the full path is constructed by traversing parent references from child to root
5. **Given** a parent with many children (100+), **When** listing children, **Then** the system efficiently handles pagination using S3 list pagination

---

### User Story 9 - Manage Folder Metadata (Priority: P2)

The system maintains folder metadata files (`_folder.yml`) that store display names and other metadata for folders in the hierarchy, allowing folders to have human-readable names independent of their GUID.

**Why this priority**: Folder metadata enables clean folder renaming and organization but isn't strictly required for MVP if folders are simply implicit containers.

**Independent Test**: Create a parent page which creates a folder structure, verify a `_folder.yml` file exists with the folder's display name, rename the parent, and confirm the metadata file is updated.

**Acceptance Scenarios**:

1. **Given** a page with GUID `abc123` becomes a parent, **When** a child is added, **Then** a folder metadata file `abc123/_folder.yml` is created with the parent's display name
2. **Given** a folder metadata file, **When** the parent is renamed, **Then** the `_folder.yml` is updated with the new display name
3. **Given** a folder exists, **When** the metadata file is read, **Then** it contains fields: `displayName`, `created`, `modified`, and optionally `description`
4. **Given** a folder with no metadata file, **When** the system encounters it, **Then** it falls back to using the parent page's title from its `.md` file
5. **Given** a folder is deleted (all children removed), **When** cleanup occurs, **Then** the `_folder.yml` file is also removed

---

### User Story 10 - Handle Attachments (Priority: P2)

Users can upload files (images, PDFs, etc.) as attachments to pages, which are stored in S3 alongside the page in an attachments subfolder using GUID-based naming.

**Why this priority**: Attachments are important for a full-featured wiki but not essential for text-based MVP. Users can work around by embedding external links initially.

**Independent Test**: Upload an image to a page, reference it in the markdown, view the page, and verify the image displays correctly by retrieving from S3 at the correct attachment path.

**Acceptance Scenarios**:

1. **Given** a page with GUID `abc123`, **When** a user uploads an attachment `photo.jpg`, **Then** it is stored in S3 at `abc123/_attachments/def456.jpg` where `def456` is a GUID
2. **Given** an attachment is uploaded, **When** stored in S3, **Then** a sidecar file `def456.meta.json` stores the original filename, upload date, and content type
3. **Given** a page with attachments, **When** the page is deleted, **Then** all attachments in the `_attachments` subfolder are also deleted
4. **Given** a page is moved, **When** the move operation completes, **Then** the entire folder including `_attachments` is moved to maintain the structure
5. **Given** an attachment is referenced in markdown as `![Photo](def456.jpg)`, **When** the page is rendered, **Then** the system resolves the GUID to generate a proper URL for the attachment

---

### Edge Cases

- What happens when two users create pages simultaneously with the same display name? Both pages are created with different GUIDs, allowing duplicate display names to coexist (user must differentiate by context/path).
- What happens when S3 connection fails during page save? System returns an error to user, page changes are not saved, and user is prompted to retry or save locally.
- What happens when a GUID collision occurs (extremely unlikely)? System detects existing GUID during creation, regenerates a new GUID, and retries (with exponential backoff after multiple failures).
- What happens when a page move operation fails mid-way (copy succeeds, delete fails)? System logs the inconsistency, maintains both copies temporarily, and provides admin tools to reconcile duplicates.
- What happens when frontmatter YAML is malformed in a stored page? System attempts to parse, falls back to treating entire content as body, and logs a warning for admin review.
- What happens when S3 bucket is versioned and a page has many historical versions? System uses S3 versioning API to retrieve history, displays version list to user, and allows viewing/restoring old versions.
- What happens when a user tries to move a page to be its own child (circular reference)? System validates the move operation, detects the circular dependency, and rejects with a clear error message.
- What happens when special characters are in display names but need to be used in URLs? System URL-encodes display names for paths while keeping GUIDs for actual S3 operations, ensuring safe URL handling.
- What happens when S3 bucket reaches millions of pages and listing becomes slow? System implements caching layer (DynamoDB) for hierarchy metadata while S3 remains source of truth for content.
- What happens when a page has no frontmatter at all? System treats it as a legacy page, generates minimal frontmatter on first edit, and uses filename (GUID) as temporary title.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement the `IStorageBackend` interface as defined in the constitution
- **FR-002**: System MUST store each page as a markdown file with a GUID-based filename (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890.md`)
- **FR-003**: System MUST use UUID v4 format for all GUIDs to ensure uniqueness
- **FR-004**: System MUST store page display names in YAML frontmatter under the `title` field
- **FR-005**: System MUST use S3 folder structure to represent hierarchy (parent GUID as folder, child file inside)
- **FR-006**: System MUST store parent reference in child page frontmatter as `parent: "<parent-guid>"`
- **FR-007**: System MUST support creating pages at root level (no parent) by storing in bucket root
- **FR-008**: System MUST support unlimited hierarchy depth (grandparent/parent/child/grandchild/...)
- **FR-009**: System MUST enable page renaming by updating frontmatter `title` without changing GUID filename
- **FR-010**: System MUST enable page moves by copying to new S3 path and deleting original
- **FR-011**: System MUST maintain folder metadata in `_folder.yml` files for each folder in the hierarchy
- **FR-012**: System MUST update frontmatter `modified` timestamp on every page save
- **FR-013**: System MUST include frontmatter fields: `title`, `parent`, `created`, `modified`, `author`
- **FR-014**: System MUST list child pages by querying S3 with parent GUID as prefix
- **FR-015**: System MUST support S3 versioning for page history (optional, best-effort per interface)
- **FR-016**: System MUST store attachments in `<page-guid>/_attachments/<attachment-guid>.<ext>` structure
- **FR-017**: System MUST store attachment metadata in sidecar JSON files (original filename, upload date, content type)
- **FR-018**: System MUST handle S3 eventual consistency by using conditional writes for concurrent updates
- **FR-019**: System MUST configure S3 bucket with appropriate CORS settings for CloudFront access
- **FR-020**: System MUST use S3 object metadata for content-type, cache-control, and last-modified headers
- **FR-021**: System MUST delete or move to trash prefix (`_trash/`) when pages are deleted
- **FR-022**: System MUST recursively move children when a parent page is moved
- **FR-023**: System MUST prevent circular hierarchy references during move operations
- **FR-024**: System MUST resolve display name paths to GUID-based S3 paths for all operations
- **FR-025**: System MUST maintain a mapping cache (DynamoDB) for display name to GUID resolution for performance

### Key Entities

- **WikiPage**: Represents a page in the wiki stored as a markdown file in S3
  - Attributes: pageId (GUID), title (display name), content (markdown body), parent (parent GUID or null), created (timestamp), modified (timestamp), author (user ID), path (S3 key)
  - Storage: S3 object with GUID filename, frontmatter contains metadata, body contains markdown content
  - Relationships: Parent-child via folder structure and frontmatter parent reference

- **FolderMetadata**: Represents metadata for a folder in the hierarchy
  - Attributes: folderId (parent page GUID), displayName, description, created, modified
  - Storage: `<folder-guid>/_folder.yml` file in S3
  - Relationships: One-to-one with parent pages that have children

- **Attachment**: Represents a file attached to a wiki page
  - Attributes: attachmentId (GUID), pageId (parent page GUID), originalFilename, contentType, size, uploadedAt, uploadedBy
  - Storage: S3 object at `<page-guid>/_attachments/<attachment-guid>.<ext>` plus metadata file `<attachment-guid>.meta.json`
  - Relationships: Belongs to one page, stored in page's attachments subfolder

- **PageVersion**: Represents a historical version of a page (via S3 versioning)
  - Attributes: versionId (S3 version ID), pageId (GUID), content, modified, author
  - Storage: S3 object versions (if versioning enabled)
  - Relationships: Multiple versions per page, accessible via S3 versioning API

- **GUIDMapping**: Cached mapping of display name paths to GUIDs for fast resolution
  - Attributes: displayPath (e.g., `/projects/alpha`), pageGuid, parentGuid, lastUpdated
  - Storage: DynamoDB table with path as partition key
  - Relationships: One-to-one with wiki pages, updated on page create/rename/move/delete

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Page creation completes in under 2 seconds including S3 upload and metadata update
- **SC-002**: Page retrieval completes in under 500ms for cached paths, under 1 second for cold lookups
- **SC-003**: Page updates save to S3 within 2 seconds with confirmation returned to user
- **SC-004**: Page renames complete instantly (under 500ms) by only updating frontmatter, not moving files
- **SC-005**: Page moves complete within 5 seconds for pages with no children, under 30 seconds for parents with up to 100 children
- **SC-006**: Child page listing for a parent with 50 children returns in under 2 seconds
- **SC-007**: System handles hierarchy depth of at least 10 levels without performance degradation
- **SC-008**: Attachment uploads complete within 10 seconds for files up to 10MB
- **SC-009**: Storage plugin passes 100% of `IStorageBackend` contract tests
- **SC-010**: System maintains GUID uniqueness with zero collisions across 100,000 page creations
- **SC-011**: Display name to GUID resolution uses DynamoDB cache with 99% hit rate after warmup
- **SC-012**: S3 storage costs remain under $2/month for typical family wiki (1,000 pages, 100 attachments, 1GB total storage)
- **SC-013**: Page history via S3 versioning allows retrieval of any version within 3 seconds
- **SC-014**: Concurrent updates to the same page are handled correctly with last-write-wins or optimistic locking
- **SC-015**: System gracefully handles S3 throttling errors with exponential backoff and retry (up to 3 attempts)

## Assumptions

- S3 bucket is created and configured before plugin initialization (bucket name provided in config)
- S3 bucket has versioning enabled for page history support (optional but recommended)
- IAM permissions are configured for Lambda to read/write S3 and read/write DynamoDB
- CloudFront distribution is configured to serve S3 content with appropriate cache headers
- DynamoDB table for GUID mapping cache is created with partition key `displayPath` (string)
- Page display names are treated as case-sensitive for path resolution
- Duplicate display names at same hierarchy level are allowed (differentiated by context)
- S3 bucket region matches Lambda function region for optimal performance
- Average page size is under 100KB markdown content (larger pages supported but may impact performance)
- Average attachment size is under 10MB (larger files supported but may require presigned URL upload)
- S3 eventual consistency delays are acceptable for non-critical operations (listing children)
- Folder metadata files (`_folder.yml`) are small (<1KB) and read frequently
- GUID generation is sufficiently random to avoid collisions (UUID v4 standard library used)
- S3 bucket naming follows AWS naming conventions (lowercase, no special chars, globally unique)
- Content-type for markdown files is `text/markdown; charset=utf-8`

## Out of Scope

The following are explicitly **not** included in this specification:

- Full-text search indexing (handled by separate search plugin module)
- Real-time collaboration or conflict resolution beyond last-write-wins (future enhancement)
- Automatic image optimization or thumbnail generation (can be added as separate feature module)
- Page templates or boilerplate content (separate feature module)
- Access control at page level (handled by authentication module, not storage)
- Page locking to prevent concurrent edits (future enhancement if needed)
- Automatic backup to separate bucket (separate operational concern)
- Migration tools from other wiki systems (separate utility)
- S3 lifecycle policies configuration (operational concern, not plugin functionality)
- Custom metadata fields beyond standard frontmatter (future enhancement)
- Page aliases or multiple paths to same content (future enhancement)
- Symbolic links or page shortcuts (future enhancement)
- Automatic orphan page detection and cleanup (future administrative tool)
- Storage quota management or size limits per user (future enhancement)
- Geo-replication or multi-region S3 setup (operational concern)
- Object tagging for cost allocation or organization (operational concern)

## Constitutional Compliance

This feature aligns with the BlueFinWiki Constitution:

- **Storage Plugin Architecture (Non-Negotiable #2)**: Implements required S3 storage backend via `IStorageBackend` interface
- **Hierarchical Page Structure (Non-Negotiable #4)**: Implements Confluence-style parent-child relationships via folder structure
- **Markdown File Format (Non-Negotiable #5)**: Stores all pages as .md files with YAML frontmatter
- **Pluggable Module Architecture (Principle I)**: Designed as pluggable module alongside GitHub storage alternative
- **Content-First Architecture (Principle II)**: Uses standard markdown, supports data portability, no vendor lock-in
- **Cost-Effectiveness (Principle III)**: Estimated $2/month for typical family usage, leverages S3 free tier (5GB storage, 20K GET requests free)
- **Simplicity (Principle III)**: GUID-based naming eliminates complex rename logic and broken link issues
- **Cloud-Agnostic Design (Principle V)**: Interface abstraction allows switching storage backends without code changes
- **Testing Requirements**: Strict TDD required per constitution for storage module implementations

## Technical Notes

### GUID-Based Naming Rationale

The GUID-based naming system provides critical benefits:
- **Renames are instant**: Only frontmatter updates, no file moves required
- **No broken links**: Internal references use GUIDs, surviving renames
- **Concurrent safety**: No filename conflicts during simultaneous page creation
- **URL stability**: Optional slug-based URLs for SEO while GUIDs are internal

### Folder Structure Example

```
s3://my-wiki-bucket/
├── abc123.md                          # Root-level page "Home"
├── def456.md                          # Root-level page "About"
├── ghi789/                            # Parent page "Projects" (GUID ghi789)
│   ├── _folder.yml                    # Folder metadata (display name, etc.)
│   ├── jkl012.md                      # Child page "Project Alpha"
│   ├── mno345.md                      # Child page "Project Beta"
│   └── pqr678/                        # Grandchild folder "Alpha Details"
│       ├── _folder.yml
│       ├── stu901.md                  # Grandchild page "Architecture"
│       └── _attachments/              # Attachments for "Architecture" page
│           ├── vwx234.png
│           └── vwx234.meta.json
└── _trash/                            # Soft-deleted pages
    └── deleted-page-guid.md
```

### Frontmatter Example

```yaml
---
title: "Project Alpha"
parent: "ghi789"
created: "2026-01-12T10:00:00Z"
modified: "2026-01-12T15:30:00Z"
author: "user-abc"
tags:
  - project
  - active
---

# Project Alpha

This is the main project page...
```

### Folder Metadata Example

```yaml
# _folder.yml
displayName: "Projects"
description: "All family projects"
created: "2026-01-12T10:00:00Z"
modified: "2026-01-12T15:30:00Z"
```
