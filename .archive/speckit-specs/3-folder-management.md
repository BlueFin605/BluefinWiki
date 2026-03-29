# Feature Specification: Folder Management (CRUD Operations)

**Feature Branch**: `3-folder-management`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "ability to mage folders, CRUD - storage is handled by the storage plug-in"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create New Folder (Priority: P1)

A user creates a new folder to organize pages hierarchically, which becomes a parent container for child pages and subfolders. The folder is created through the storage plugin interface.

**Why this priority**: Folders are fundamental to the hierarchical organization required by the constitution. Without folders, users cannot create the parent-child page structure.

**Independent Test**: Create a new folder "Projects" at root level, verify it appears in the wiki navigation, and confirm through the storage plugin that the folder structure exists (e.g., folder metadata file in S3 or directory in GitHub).

**Acceptance Scenarios**:

1. **Given** a user is authenticated with Editor or Admin role, **When** they create a new folder named "Projects" at root level, **Then** the folder is created via the storage plugin and appears in the wiki navigation
2. **Given** a folder creation request, **When** processed by the storage plugin, **Then** the appropriate folder structure is created (S3: folder metadata file, GitHub: directory with .gitkeep or metadata file)
3. **Given** a new folder is created, **When** stored, **Then** metadata includes folder name, creation timestamp, creator user ID, and optional description
4. **Given** an existing parent folder, **When** a user creates a subfolder within it, **Then** the subfolder is nested correctly in the hierarchy
5. **Given** a folder name with special characters, **When** creating the folder, **Then** the name is sanitized for safe storage while preserving display name

---

### User Story 2 - View Folder Contents (Priority: P1)

A user navigates to a folder and sees all child pages and subfolders contained within it, retrieved through the storage plugin's list children operation.

**Why this priority**: Viewing folder contents is essential for navigation. Without this, users cannot browse or access pages within folders.

**Independent Test**: Create a folder with 3 pages and 2 subfolders, navigate to the folder in the wiki, and verify all 5 items are displayed correctly sorted by type (folders first) and then alphabetically.

**Acceptance Scenarios**:

1. **Given** a folder contains pages and subfolders, **When** a user navigates to the folder, **Then** the storage plugin's `listChildren()` method returns all items
2. **Given** folder contents are retrieved, **When** displayed to user, **Then** subfolders are shown first (with folder icon), followed by pages (with page icon)
3. **Given** folder contents, **When** sorted, **Then** items within each group (folders, pages) are sorted alphabetically by display name
4. **Given** an empty folder, **When** viewed, **Then** the user sees a message "This folder is empty" with an option to create a page or subfolder
5. **Given** a folder with many items (50+), **When** viewed, **Then** pagination is applied showing 25 items per page with navigation controls

---

### User Story 3 - Rename Folder (Priority: P1)

A user renames a folder to better reflect its contents, which updates the folder's display name through the storage plugin without breaking references to pages within it.

**Why this priority**: Renaming is essential for organizing and maintaining a clean structure. The GUID-based storage system enables this without breaking links.

**Independent Test**: Create a folder "Temp Projects", add pages to it, rename it to "Active Projects", and verify the folder shows the new name while all child pages remain accessible at their correct paths.

**Acceptance Scenarios**:

1. **Given** a folder named "Old Name", **When** a user renames it to "New Name", **Then** the storage plugin updates the folder metadata with the new display name
2. **Given** a folder is renamed, **When** the change is saved, **Then** all child pages remain at their existing storage locations (GUID-based structure preserves references)
3. **Given** a folder rename, **When** completed, **Then** the folder's URL path reflects the new name and breadcrumb navigation updates accordingly
4. **Given** a folder with subfolders and pages, **When** renamed, **Then** all children remain accessible and their parent references are valid
5. **Given** a user tries to rename a folder to an empty name, **When** submitted, **Then** validation error prevents the rename with message "Folder name cannot be empty"

---

### User Story 4 - Move Folder to Different Parent (Priority: P2)

A user moves a folder from one parent location to another (or to root level), which relocates the folder and all its contents through the storage plugin's move operation.

**Why this priority**: Moving folders is important for reorganization but not essential for initial functionality. Users can work around by manually moving individual pages.

**Independent Test**: Create folder "A/B/C" (nested), move folder "C" to root level, verify "C" now appears at root with all its original contents intact and accessible.

**Acceptance Scenarios**:

1. **Given** a folder nested under parent "A", **When** moved to parent "B", **Then** the storage plugin's `movePage()` method relocates the folder and all contents
2. **Given** a folder move operation, **When** executed, **Then** all child pages and subfolders move with the parent maintaining relative hierarchy
3. **Given** a folder is moved, **When** completed, **Then** the folder's parent reference updates to the new location
4. **Given** a user tries to move a folder to be its own descendant, **When** attempted, **Then** validation prevents the circular reference with error message
5. **Given** a folder move in progress, **When** partially completed and then fails, **Then** the system attempts rollback or marks the state for admin cleanup

---

### User Story 5 - Delete Folder (Priority: P2)

A user deletes a folder, which either requires the folder to be empty or recursively deletes all contents through the storage plugin, depending on configuration.

**Why this priority**: Deletion is important for cleanup but not essential for MVP. Users can work around by moving unwanted folders or leaving them empty.

**Independent Test**: Create an empty folder, delete it, and verify it's removed from navigation and storage. Then create a folder with contents, attempt delete, and verify protection prevents accidental data loss.

**Acceptance Scenarios**:

1. **Given** an empty folder, **When** a user deletes it, **Then** the storage plugin removes the folder structure and metadata
2. **Given** a folder with child pages or subfolders, **When** a user attempts to delete it, **Then** the system shows a warning "Folder contains X items" and requires confirmation
3. **Given** a folder deletion with confirmation, **When** user confirms recursive delete, **Then** all child pages and subfolders are deleted via storage plugin
4. **Given** a folder deletion configuration set to "require empty", **When** user tries to delete non-empty folder, **Then** operation is blocked with error "Folder must be empty before deletion"
5. **Given** a soft-delete configuration, **When** folder is deleted, **Then** it's moved to trash folder via storage plugin rather than permanently removed

---

### User Story 6 - Set Folder Description/Metadata (Priority: P3)

A user can add or edit a folder's description and other metadata (tags, color coding) to provide context about the folder's purpose and contents.

**Why this priority**: Metadata enhances organization but is not essential for basic folder functionality. Core operations (create, view, rename, move) are sufficient for MVP.

**Independent Test**: Create a folder, add description "Contains all project documentation", view the folder, and verify the description displays prominently below the folder title.

**Acceptance Scenarios**:

1. **Given** a folder exists, **When** a user edits folder properties, **Then** they can add or update a description field (markdown supported)
2. **Given** folder metadata is updated, **When** saved, **Then** the storage plugin updates the folder metadata file with new description and modified timestamp
3. **Given** a folder with description, **When** viewed, **Then** the description is displayed below the folder title before listing contents
4. **Given** a folder, **When** metadata is edited, **Then** optional fields include tags (array), color code (hex), and icon (emoji or icon name)
5. **Given** folder metadata fields, **When** displayed in navigation, **Then** color coding and icons are applied to folder display in tree view

---

### User Story 7 - Duplicate/Copy Folder (Priority: P3)

A user creates a copy of an existing folder and all its contents to use as a template or backup, which creates new GUIDs for all items through the storage plugin.

**Why this priority**: Duplication is a convenience feature for power users but not essential. Users can manually recreate structure if needed.

**Independent Test**: Create a template folder "Project Template" with standard pages, duplicate it to create "New Project Alpha", and verify the copy has all the same pages with new GUIDs and independent content.

**Acceptance Scenarios**:

1. **Given** a folder with contents, **When** a user selects "Duplicate Folder", **Then** a new folder is created with name "Copy of [Original Name]"
2. **Given** a folder duplication, **When** processing, **Then** the storage plugin creates new GUIDs for the folder and all contained pages/subfolders
3. **Given** duplicated folder contents, **When** pages are copied, **Then** internal links between pages within the folder are updated to reference the new copied pages
4. **Given** a folder with attachments, **When** duplicated, **Then** attachments are also copied to the new folder structure
5. **Given** a deep folder hierarchy being duplicated, **When** processing large structures, **Then** operation shows progress indicator and can be cancelled

---

### User Story 8 - Search Within Folder (Priority: P3)

A user searches for pages within a specific folder and its subfolders, limiting search scope to a particular branch of the hierarchy.

**Why this priority**: Scoped search is useful but not essential when global search works well. Users can filter global search results by path.

**Independent Test**: Create folder "Projects" with subfolders containing 20 pages, search for "architecture" within "Projects" folder only, and verify results are limited to that folder's hierarchy.

**Acceptance Scenarios**:

1. **Given** a user is viewing a folder, **When** they perform a search, **Then** they can choose "Search in this folder" option
2. **Given** a folder-scoped search, **When** executed, **Then** the search plugin receives folder path filter and limits results to that hierarchy branch
3. **Given** search results within folder, **When** displayed, **Then** relative paths show hierarchy within the folder (e.g., "subfolder/page")
4. **Given** a folder-scoped search, **When** no results found, **Then** user is offered option to search globally
5. **Given** folder search, **When** multiple nested levels exist, **Then** search includes all descendants unless "current level only" option is selected

---

### Edge Cases

- What happens when a user creates a folder with the same name as an existing folder at the same level? Both folders exist with different GUIDs; display names may match but are differentiated by context or path.
- What happens when storage plugin fails during folder creation? Error is returned to user, operation is not persisted, and user can retry.
- What happens when moving a large folder with 100+ pages? Operation is queued as background job with progress tracking, user receives notification when complete.
- What happens when folder metadata file is corrupted or missing? System falls back to using the folder's GUID or scanning contained pages to infer folder name.
- What happens when a folder is renamed to contain invalid characters (e.g., slashes)? Characters are automatically sanitized (replaced or removed) while preserving readability.
- What happens when deleting a folder with pages currently being edited by other users? System warns about active editors and either blocks deletion or notifies other users of the delete operation.
- What happens when a folder has no child pages but has subfolders with pages? System considers it non-empty and applies same deletion protection as folders with direct children.
- What happens when viewing a folder that was recently created but storage replication is still pending? User sees the folder but with "loading contents..." message until replication completes.
- What happens when a folder structure exceeds maximum hierarchy depth (e.g., 20 levels)? System enforces depth limit and prevents creating deeper nesting with error "Maximum folder depth reached".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide folder CRUD operations through abstraction layer that delegates to storage plugin
- **FR-002**: System MUST call storage plugin's appropriate methods for all folder operations (create, read, update, delete, move)
- **FR-003**: All authenticated users MUST be able to create folders at any level in the hierarchy
- **FR-004**: System MUST validate folder names to ensure they are non-empty and contain valid characters
- **FR-005**: System MUST support creating folders at root level (no parent) and nested within other folders
- **FR-007**: System MUST retrieve folder contents by calling storage plugin's `listChildren()` method with folder path
- **FR-008**: System MUST display folder contents with subfolders listed before pages, both sorted alphabetically
- **FR-009**: System MUST support renaming folders through storage plugin while preserving child page references
- **FR-010**: System MUST update folder URLs and breadcrumbs when folder is renamed
- **FR-011**: System MUST support moving folders through storage plugin's `movePage()` method
- **FR-012**: System MUST validate folder moves to prevent circular references (folder cannot be its own ancestor)
- **FR-013**: System MUST move all child pages and subfolders when parent folder is moved
- **FR-014**: System MUST support folder deletion with configurable behavior (require empty, allow recursive, soft delete)
- **FR-015**: System MUST warn users before deleting non-empty folders with item count
- **FR-016**: System MUST enforce role-based permissions for all folder operations
- **FR-017**: System MUST store folder metadata (name, description, created, modified, creator) via storage plugin
- **FR-018**: System MUST support optional folder metadata fields (description, tags, color, icon)
- **FR-019**: System MUST paginate folder contents when more than 25 items exist
- **FR-020**: System MUST provide breadcrumb navigation showing full folder hierarchy path
- **FR-021**: System MUST generate folder URLs that reflect the hierarchy (e.g., `/wiki/projects/active`)
- **FR-022**: System MUST resolve folder display names to storage plugin paths (GUID-based or otherwise)
- **FR-023**: System MUST handle storage plugin errors gracefully with user-friendly error messages
- **FR-024**: System MUST support folder duplication creating new GUIDs for all copied items (P3 feature)
- **FR-025**: System MUST support folder-scoped search by passing folder path to search plugin (P3 feature)

### Key Entities

- **Folder**: Represents a container for organizing pages and subfolders in the hierarchy
  - Attributes: folderId (GUID or path), displayName, description, parentId (GUID or null for root), created, modified, creator, tags, colorCode, icon
  - Storage: Managed entirely by storage plugin (S3: folder metadata file, GitHub: directory with metadata)
  - Relationships: Can contain child pages and subfolders, belongs to parent folder or root
  - Operations: Create, read, update (rename, metadata), move, delete via storage plugin interface

- **FolderContents**: Represents the list of items (pages and subfolders) within a folder
  - Attributes: folderId, childFolders (array), childPages (array), totalCount, hasMore (for pagination)
  - Storage: Retrieved dynamically from storage plugin via `listChildren()` method
  - Relationships: One folder has many child items

- **FolderOperation**: Represents an operation being performed on a folder (for async operations)
  - Attributes: operationId, type (move, delete, duplicate), folderId, status (pending, in-progress, completed, failed), progress, startTime, completedTime
  - Storage: DynamoDB or in-memory queue for operation tracking
  - Relationships: One operation affects one folder and potentially many descendants

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Folder creation completes within 2 seconds including storage plugin persistence
- **SC-002**: Folder contents listing for folders with 25 items loads within 1 second
- **SC-003**: Folder rename operation completes within 1 second (metadata update only)
- **SC-004**: Folder move operation completes within 5 seconds for folders with up to 50 items
- **SC-005**: Empty folder deletion completes within 1 second
- **SC-006**: Non-empty folder deletion (recursive) processes at least 10 items per second with progress tracking
- **SC-007**: Folder operations work correctly with 100% of storage plugins (S3, GitHub, future plugins)
- **SC-008**: Folder hierarchy supports at least 10 levels of nesting without performance degradation
- **SC-009**: Breadcrumb navigation generates correctly for folders at any depth within 100ms
- **SC-010**: Folder display names resolve to storage paths within 200ms using cache layer
- **SC-011**: Role-based permissions prevent unauthorized folder operations with 100% accuracy
- **SC-012**: Circular reference detection prevents invalid folder moves with 100% accuracy
- **SC-013**: Folder metadata updates (description, tags) save within 1 second via storage plugin
- **SC-014**: Pagination displays folder contents correctly for folders with up to 1000 items
- **SC-015**: Error messages from storage plugin failures are user-friendly and actionable (no technical stack traces exposed)

## Assumptions

- Storage plugin implements folder support through its standard interface (S3: folder metadata files, GitHub: directories)
- All folder operations delegate to storage plugin rather than implementing separate folder storage
- GUID-based naming in storage plugin enables instant folder renames without moving files
- DynamoDB or similar cache layer exists for mapping folder display names to storage paths
- Folder operations respect the same authentication and authorization as page operations
- Concurrent folder operations are handled by storage plugin's consistency mechanisms
- Folder display names are case-sensitive for uniqueness checks
- Empty folders are allowed and don't require immediate deletion
- Maximum hierarchy depth of 20 levels is sufficient for family wiki organization
- Average folder contains fewer than 50 direct children (pages + subfolders)
- Folder operations are less frequent than page operations (optimize for read performance)
- Storage plugin errors include enough context to generate helpful user error messages
- Folder metadata size is small (<5KB) and can be loaded efficiently
- System clock/timestamps are reliable for created/modified tracking

## Out of Scope

The following are explicitly **not** included in this specification:

- Folder templates with predefined page structures (future feature module)
- Folder permissions different from user's global role (page-level permissions future enhancement)
- Folder sharing or collaboration features beyond standard user roles (future enhancement)
- Folder subscriptions or notifications for changes (separate notification module)
- Folder statistics (page count, total size, last activity) (future analytics feature)
- Folder bookmarking or favorites (separate feature module)
- Folder export as ZIP or archive (separate export module)
- Folder versioning or history beyond storage plugin's capabilities (storage plugin responsibility)
- Folder merge operations (combining two folders) (future enhancement if needed)
- Folder aliases or multiple names for same folder (future enhancement)
- Automatic folder organization based on rules or AI (future enhancement)
- Folder activity feed showing recent changes (separate activity feature)
- Folder sorting preferences per user (future personalization feature)
- Folder icons from custom uploads (limited to emoji or preset icons initially)
- Folder color schemes beyond simple color coding (future theme enhancement)

## Constitutional Compliance

This feature aligns with the BlueFinWiki Constitution:

- **Hierarchical Page Structure (Non-Negotiable #4)**: Core functionality enabling Confluence-style parent-child relationships through folders
- **Pluggable Module Architecture (Non-Negotiable #1)**: Delegates all storage to storage plugin via interface
- **Markdown File Format (Non-Negotiable #5)**: Folder metadata stored in standard formats compatible with markdown file storage
- **Storage Plugin Architecture (Non-Negotiable #2)**: Works seamlessly with both S3 and GitHub storage backends
- **Simplicity (Principle III)**: Straightforward folder operations without complex features
- **Family-Friendly (Principle IV)**: Intuitive folder navigation suitable for all ages
- **Content-First (Principle II)**: Folders serve organization and discovery of content
- **Role-Based Access (Principle VI)**: Folder operations respect user roles (Admin, Editor, Viewer)

## Technical Notes

### Storage Plugin Integration

All folder operations delegate to the storage plugin:

**Create Folder**:
```typescript
// Create folder by creating a page that acts as parent
await storagePlugin.createPage(
  folderPath,
  '# Folder Content', // Optional folder index page
  { title: folderName, isFolder: true, ... }
);
```

**List Folder Contents**:
```typescript
const contents = await storagePlugin.listChildren(folderPath);
// Returns array of pages and subfolders
```

**Rename Folder**:
```typescript
await storagePlugin.updatePage(
  folderPath,
  content, // unchanged
  { ...metadata, title: newName }
);
```

**Move Folder**:
```typescript
await storagePlugin.movePage(oldFolderPath, newFolderPath);
// Plugin handles moving all contents
```

**Delete Folder**:
```typescript
await storagePlugin.deletePage(folderPath);
// Behavior depends on plugin config (require empty, recursive, etc.)
```

### Folder Representation

Folders are represented differently by each storage plugin:
- **S3 Plugin**: Folder = GUID directory with `_folder.yml` metadata file
- **GitHub Plugin**: Folder = directory with `.folder.yml` or `README.md`
- **Other Plugins**: Implement according to their storage model

The abstraction layer handles these differences transparently.
