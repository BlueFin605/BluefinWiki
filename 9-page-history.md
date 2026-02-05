# Feature Specification: Page History & Version Management

**Feature Branch**: `9-page-history`  
**Created**: 2026-01-12  
**Updated**: 2026-01-13  
**Status**: Clarified  
**Input**: User description: "How users view page history, compare versions, and restore previous versions: View page version history, Compare two versions (diff view), Restore previous version, Track who made what changes"

## Design Decisions

Based on clarifications documented in `clarifications.md`:

- **Storage Strategy**: Explicit version files stored separately (not relying on S3/GitHub native versioning)
- **Metadata Storage**: Platform-agnostic metadata files (`.meta.json`) stored alongside content
- **Version IDs**: GUIDs for platform-agnostic identification
- **Version Numbers**: Incremental integers stored in metadata file
- **Concurrent Edits**: Optimistic locking with ETags, conflict detection on save
- **Change Descriptions**: NOT included in MVP (removed from all user stories)
- **Deleted Pages**: Soft delete with "Recently Deleted" UI, marked in metadata
- **DynamoDB**: Optional for GitHub storage (metadata files are primary source)
- **Performance**: Monitor and optimize post-MVP if issues arise
- **Export**: Not in MVP
- **Permalinks**: RESTful format `/pages/{pageId}/versions/{versionId}` with required authentication

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Page Version History (Priority: P1)

A user views the complete version history of a wiki page to understand how the page has evolved over time, seeing a chronological list of all changes with timestamps, authors, and change summaries.

**Why this priority**: Version history is a constitutional requirement ("Version history and 'undo' capabilities") and provides essential audit trail for collaborative wikis. Families need to see who changed what and when, especially for important information.

**Independent Test**: Create a page, edit it 3 times with different users, navigate to "History" view, and verify all 3 versions are listed with correct timestamps, authors, and version numbers.

**Acceptance Scenarios**:

1. **Given** a user views any wiki page, **When** they click the "History" button in the toolbar, **Then** they see a chronological list of all page versions from newest to oldest
2. **Given** the history view is displayed, **When** viewing a version entry, **Then** each entry shows: version number, timestamp, and author name
3. **Given** a page with 50+ versions, **When** viewing history, **Then** versions are paginated (20 per page) with navigation controls
4. **Given** a user views a version in the history list, **When** they click on that version, **Then** they are taken to a read-only preview of the page content at that point in time
5. **Given** a version preview, **When** displayed, **Then** a banner indicates "Viewing historical version [N] from [date]" with "Return to current version" button
6. **Given** the history view, **When** a page was created, **Then** the first version shows "Page created" as system metadata
7. **Given** the history view, **When** retrieving versions, **Then** versions are loaded from metadata files stored alongside page content
8. **Given** the history view, **When** storage plugin is GitHub, **Then** Git commit metadata is synchronized to metadata files for consistent access

---

### User Story 2 - Compare Two Page Versions (Diff View) (Priority: P1)

A user selects two versions of a page to see a side-by-side or unified diff view that clearly highlights what content was added, removed, or modified between those versions.

**Why this priority**: Comparing versions is essential for understanding changes and reviewing edits. This is particularly important for family wikis where accidental or unwanted changes need to be identified quickly.

**Independent Test**: Select version 1 and version 3 of a test page, click "Compare", and verify additions are shown in green, deletions in red, and unchanged content is visible for context.

**Acceptance Scenarios**:

1. **Given** the history view, **When** a user selects two versions using checkboxes, **Then** a "Compare Selected" button becomes enabled
2. **Given** two versions are selected, **When** user clicks "Compare", **Then** a diff view loads showing differences between the versions
3. **Given** the diff view, **When** content was added, **Then** new lines are highlighted in green with a "+" indicator
4. **Given** the diff view, **When** content was removed, **Then** deleted lines are highlighted in red with a "-" indicator
5. **Given** the diff view, **When** content was modified, **Then** the old version (red) and new version (green) are shown adjacent or inline
6. **Given** the diff view, **When** displaying changes, **Then** unchanged content is shown for context (configurable: 3-5 lines before/after changes)
7. **Given** the diff view, **When** user toggles view mode, **Then** they can switch between "Side-by-side" and "Unified" diff formats
8. **Given** the diff view header, **When** displayed, **Then** it shows: "Comparing Version [N] ([date], [author]) with Version [M] ([date], [author])"
9. **Given** large diffs (500+ lines changed), **When** viewing, **Then** the diff is virtualized/lazy-loaded for performance
10. **Given** the diff view, **When** markdown formatting is present, **Then** the diff shows markdown source (not rendered HTML) for clarity

---

### User Story 3 - Restore Previous Version (Priority: P1)

A user restores a previous version of a page to undo unwanted changes or recover lost content, creating a new version that contains the content from the selected historical version.

**Why this priority**: Restore capability is a constitutional requirement and critical for recovering from mistakes. Families need confidence that accidental deletions or unwanted edits can be undone easily.

**Independent Test**: Edit a page to delete important content, verify the deletion, navigate to history, select the previous version, click "Restore", and verify the content is recovered and a new version is created.

**Acceptance Scenarios**:

1. **Given** a user views a historical version preview, **When** they click "Restore this version" button, **Then** a confirmation dialog appears explaining the restore action
2. **Given** the restore confirmation dialog, **When** it displays, **Then** it warns: "This will create a new version with content from version [N]. Current content will be preserved in history."
3. **Given** the confirmation dialog, **When** user clicks "Confirm Restore", **Then** a new version is created with content from the selected historical version
4. **Given** a restore action, **When** successful, **Then** the new version's metadata indicates "Restored from version [N]" with automatic attribution
5. **Given** a restore action, **When** completed, **Then** the user is redirected to the current (newly restored) page view
6. **Given** a restored version, **When** viewing history, **Then** the restore appears as a new entry showing who performed the restore and when
7. **Given** a user attempts restore, **When** they lack edit permissions, **Then** the restore button is disabled with tooltip "Requires edit permission"
8. **Given** a restore in progress, **When** saving the version, **Then** the content is written as a new version file with updated metadata
9. **Given** a restore in progress, **When** storage plugin is GitHub, **Then** a new commit is created with message "Restored from version [id]"
10. **Given** a page with attachments, **When** restoring a version, **Then** attachments are NOT restored (only page content) with a warning message displayed

---

### User Story 4 - Track Author Attribution and Change Metadata (Priority: P2)

Users can see detailed metadata for each page version including who made changes, when, and from what device/location (if available), providing accountability and context for understanding page evolution.

**Why this priority**: Attribution is essential for accountability in collaborative environments and helps families understand the context of changes. While important, it's secondary to core history/restore functionality.

**Independent Test**: Edit a page while logged in as "Alice", save, then view history and verify Alice's name and timestamp appear correctly.

**Acceptance Scenarios**:

1. **Given** the history view, **When** displaying versions, **Then** each entry shows the author's display name (not email) and timestamp
2. **Given** version metadata, **When** stored, **Then** it includes: version ID (GUID), parent version ID, author user ID, timestamp, and content hash
3. **Given** the history view, **When** a version is listed, **Then** clicking the author's name shows their profile or filters history to show only their changes
4. **Given** the page editor, **When** concurrent edits are detected via ETag mismatch, **Then** users are warned and shown the conflicting version before being allowed to save
5. **Given** version metadata, **When** stored, **Then** it is saved in a `.meta.json` file alongside the page content in platform-agnostic format
6. **Given** a restored version, **When** viewing its metadata, **Then** it shows both the restoring user and references the original version author

---

### User Story 5 - Version Comparison Quick Actions (Priority: P2)

Users can quickly compare consecutive versions or compare any version against the current version with one-click actions, streamlining common comparison workflows.

**Why this priority**: Quick actions reduce friction for common tasks, but the core comparison functionality (Story 2) is sufficient for MVP. This improves UX for frequent operations.

**Independent Test**: From the history view, hover over any version entry, click the "Compare with current" quick action icon, and verify diff view loads immediately without multi-step selection.

**Acceptance Scenarios**:

1. **Given** the history view, **When** hovering over a version entry, **Then** quick action icons appear: "Compare with current" and "Compare with previous"
2. **Given** a version entry (except the current version), **When** clicking "Compare with current" icon, **Then** diff view opens comparing that version to the current version
3. **Given** a version entry (except version 1), **When** clicking "Compare with previous" icon, **Then** diff view opens comparing that version to the immediately preceding version
4. **Given** the history view, **When** in mobile/small screen mode, **Then** quick actions are accessible via context menu (three dots) instead of hover icons
5. **Given** the current version entry, **When** displayed in history, **Then** only "Compare with previous" action is available (no "Compare with current")

---

### User Story 6 - Version Export and Permalinks (Priority: P3)

**Note**: This feature is deferred to post-MVP. Permalinks will be implemented for accessing specific versions, but export functionality is not included in the initial release.

Users can share permanent links to specific versions for reference and documentation purposes.

**Why this priority**: Permalinks are valuable for documentation workflows but export features are not essential for MVP. Core history/restore features provide the primary value.

**Independent Test**: View version 5 of a page, click "Copy permalink", paste URL in new browser tab, and verify it loads the historical version.

**Acceptance Scenarios**:

1. **Given** any version preview, **When** user clicks "Copy permalink" button, **Then** a permanent URL to that specific version is copied to clipboard
2. **Given** a permalink to a historical version, **When** accessed by any authenticated user, **Then** they see the page content as it appeared in that version with historical context banner
3. **Given** permalinks, **When** generated, **Then** URL format is: `/pages/{pageId}/versions/{versionId}` (RESTful path with GUIDs)
4. **Given** a permalink, **When** accessed by unauthenticated user, **Then** authentication is required before displaying the version

---

### Edge Cases

- **Concurrent edits**: What happens when two users edit the same page simultaneously? System detects conflicts via ETag/version token mismatch on save and shows side-by-side comparison for manual merge or resolution.
- **Large pages**: How does the system handle diff views for very large pages (10,000+ lines)? Must implement virtualization and lazy loading for performance.
- **Version limits**: Is there a maximum number of versions retained? Configurable per-wiki retention policy (default: keep all versions, admin can set limits).
- **Storage backend consistency**: All storage backends use explicit version files with `.meta.json` metadata files for platform-agnostic version management.
- **Deleted pages**: Can users view history of deleted pages? Yes, through "Recently Deleted" UI section. Pages are soft-deleted (marked in metadata) and can be recovered within retention period.
- **Binary diffs**: How to show diffs when page contains embedded base64 images or other binary content? Show metadata change only, not binary diff.
- **First version**: What does "compare with previous" show for version 1? Disable the action or show creation metadata only.
- **Permission changes**: What if a user's permissions change after they created versions? History shows their attributed versions but they may not be able to restore if they lost edit permission. Permission loss revokes history access.
- **Restore conflicts**: What if page was edited after user navigated to history but before restore? ETag mismatch detected; show warning and offer to view latest version or force restore.
- **Attachment versioning**: This spec explicitly excludes attachment versioning (Story 3 acceptance #10). Future spec needed for attachment history.
- **Version ordering**: Use server timestamp for consistency in version ordering.
- **Caching**: No version content caching in MVP. Monitor costs and performance; implement caching in Phase 2 if needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST retain complete version history for every page edit, storing: content, author, and timestamp in platform-agnostic metadata files
- **FR-002**: System MUST display version history in reverse chronological order (newest first) with pagination for pages with 20+ versions
- **FR-003**: Users MUST be able to view read-only preview of any historical version by clicking it in the history list
- **FR-004**: System MUST provide diff/comparison view between any two page versions showing additions (green), deletions (red), and modifications
- **FR-005**: System MUST support both side-by-side and unified diff view formats, user-selectable
- **FR-006**: Users with edit permissions MUST be able to restore any previous version, creating a new version with the historical content
- **FR-007**: System MUST track version metadata including: version ID (GUID), author user ID, timestamp (UTC), parent version ID, and content hash
- **FR-008**: System MUST handle version storage consistently across backends:
  - **All Storage**: Use explicit version files with naming convention `{pageGuid}/v{versionNumber}.md` and `.meta.json` metadata files
  - **GitHub Storage**: Synchronize Git commit metadata to `.meta.json` files for consistent access
- **FR-009**: System MUST prevent data loss: restore operations create new versions rather than overwriting history
- **FR-010**: System MUST display clear attribution for each version: author name and timestamp in history view
- **FR-011**: System MUST provide quick comparison actions: "Compare with current" and "Compare with previous" from history entries
- **FR-012**: System MUST detect concurrent edit conflicts using optimistic locking (ETags) and provide side-by-side comparison for manual resolution
- **FR-013**: System MUST generate permanent URLs (permalinks) to specific page versions in format `/pages/{pageId}/versions/{versionId}` with required authentication
- **FR-014**: System MUST respect user permissions for all version operations: view permission required for history access, edit permission required for restore
- **FR-015**: System MUST optimize performance for large diffs by implementing virtualization for diffs exceeding 500 lines
- **FR-016**: System MUST preserve version history when pages are soft-deleted (marked in metadata), accessible through "Recently Deleted" UI
- **FR-017**: Version history UI MUST be accessible via prominent "History" button in page toolbar/menu
- **FR-018**: System MUST indicate historical context clearly when viewing old versions with banner: "Viewing version [N] from [date]"
- **FR-019**: Restore confirmation dialog MUST clearly explain action and impact: "Creates new version with old content, preserves current in history"
- **FR-020**: System MUST use incremental version numbers stored in metadata files, automatically incremented on each save

### Key Entities

- **PageVersion**: Represents a specific snapshot of page content at a point in time
  - Attributes: versionId (GUID), pageId (GUID), versionNumber (integer, auto-incrementing), content (markdown text), authorUserId (GUID), timestamp (ISO 8601 UTC), parentVersionId (GUID), contentHash (SHA256), storageReference (file path or Git commit SHA), isDeleted (boolean)
  - Relationships: Belongs to Page, created by User, references parent PageVersion
  - Storage: `.meta.json` file stored alongside version content file, contains all metadata in platform-agnostic JSON format

- **VersionMetadataFile**: JSON file containing version metadata (`.meta.json`)
  - Format:
    ```json
    {
      "versionId": "uuid",
      "versionNumber": 1,
      "pageId": "uuid",
      "authorUserId": "uuid",
      "timestamp": "2026-01-13T10:30:00Z",
      "parentVersionId": "uuid",
      "contentHash": "sha256hash",
      "isDeleted": false,
      "restoredFrom": "uuid (optional)"
    }
    ```

- **VersionComparison**: Transient entity representing diff between two versions
  - Attributes: fromVersionId, toVersionId, diffFormat (unified|sideBySide), changeBlocks (array of addition/deletion/modification regions)
  - Not persisted; computed on-demand from version content

- **RestoreAction**: Audit record of version restore operations
  - Attributes: Stored in new version's metadata as `restoredFrom` field referencing original version ID

### Non-Functional Requirements

- **NFR-001**: Version history operations SHOULD complete in reasonable time; specific timing targets deferred until MVP performance testing
- **NFR-002**: System MUST maintain version history integrity with 99.99% durability (leveraging S3/GitHub durability guarantees)
- **NFR-003**: Version data storage overhead MUST NOT exceed 10% beyond raw content size (efficient metadata storage in JSON)
- **NFR-004**: History UI MUST be responsive and accessible, meeting WCAG 2.1 AA standards (per constitution)
- **NFR-005**: Version retention MUST be configurable per-wiki with admin-defined policies (default: unlimited retention)
- **NFR-006**: System SHOULD implement caching strategies post-MVP if performance or cost issues arise

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view complete version history of any page and navigate to any historical version within 3 clicks
- **SC-002**: Users can identify what changed between any two versions within 30 seconds using diff view
- **SC-003**: Users can successfully restore a previous version to recover from unwanted changes in under 1 minute
- **SC-004**: 95% of version history operations (view, compare, restore) complete without errors or timeouts
- **SC-005**: Version attribution is accurate 100% of the time, showing correct author and timestamp for each change
- **SC-006**: Diff views accurately highlight all changes (additions, deletions, modifications) with zero false positives/negatives for standard markdown content
- **SC-007**: Storage costs for version history remain within constitutional $5/month target for typical family usage (estimated 100 pages, average 10 versions per page)
- **SC-008**: Users with non-technical backgrounds can successfully use history features without training or documentation 90% of the time
- **SC-009**: Conflict detection prevents data loss from concurrent edits 100% of the time via ETag validation

## Alignment with Constitution

This feature directly satisfies the following constitutional principles:

### Non-Negotiables Compliance
- **Content-First Architecture**: Version history ensures content preservation and auditability, reinforcing content ownership
- **Markdown File Format**: All versions stored as standard .md files (S3) or Git commits (GitHub), maintaining portability

### Core Principles Addressed

1. **"Version history and 'undo' capabilities"** (Section IV: Family-Friendly Experience)
   - Directly implements the constitutional requirement for version history
   - Restore functionality provides comprehensive "undo" capability beyond simple revert

2. **Cost-Effectiveness** (Section III)
   - S3 storage leverages native S3 versioning (minimal overhead) or efficient file-based versioning
   - GitHub storage uses Git's built-in version control (zero additional cost)
   - DynamoDB metadata storage minimal (estimated $0.10-0.25/month for version indexes)

3. **Family-Friendly Experience** (Section IV)
   - Simple, clear UI for viewing and understanding changes
   - One-click restore with confirmation prevents accidental actions
   - Clear attribution helps families track who changed what

4. **Pluggable Module Architecture** (Section I)
   - Version management adapts to storage backend (S3 vs GitHub) through storage plugin interface
   - Could extend to support different versioning strategies as plugins

5. **Privacy & Security** (Section VI)
   - Version history respects existing page permissions
   - Audit trail of all changes supports security and accountability

## Technical Considerations

### Storage Plugin Architecture

The version management system must abstract version storage through the pluggable storage interface:

```typescript
interface IStorageBackend {
  // Existing methods...
  
  // Version management methods
  listPageVersions(pageId: string, options?: PaginationOptions): Promise<PageVersion[]>;
  getPageVersion(pageId: string, versionId: string): Promise<PageVersion>;
  savePageVersion(pageId: string, content: string, metadata: VersionMetadata): Promise<PageVersion>;
  compareVersions(pageId: string, fromVersionId: string, toVersionId: string): Promise<VersionDiff>;
  getVersionMetadata(pageId: string, versionId: string): Promise<VersionMetadata>;
  updateVersionMetadata(pageId: string, versionId: string, metadata: VersionMetadata): Promise<void>;
}
```

### Version File Storage Structure

All storage backends use consistent file structure:

```
pages/
  {page-guid}/
    current.md              # Current page content
    .meta.json             # Current version metadata
    versions/
      v1.md                # Version 1 content
      v1.meta.json         # Version 1 metadata
      v2.md                # Version 2 content
      v2.meta.json         # Version 2 metadata
      ...
```

### S3 Storage Plugin Implementation

- Store each version as separate file with explicit naming
- Metadata stored in `.meta.json` files alongside content
- No reliance on S3 object versioning feature
- Pros: Full control, platform-agnostic, simple to understand
- Cons: More files to manage (offset by clear structure)

### GitHub Storage Plugin Implementation

- Each page save creates a Git commit
- Commit SHA stored in `.meta.json` as reference
- Commit message auto-generated from metadata
- Git operations synchronized with metadata file updates
- Metadata files provide consistent API regardless of Git operations
- Use GitHub API or local Git operations for underlying storage

### Metadata File Schema

**File**: `.meta.json` (stored with each version)

```json
{
  "versionId": "550e8400-e29b-41d4-a716-446655440000",
  "versionNumber": 5,
  "pageId": "123e4567-e89b-12d3-a456-426614174000",
  "authorUserId": "789e0123-e89b-12d3-a456-426614174000",
  "authorName": "Alice Johnson",
  "timestamp": "2026-01-13T15:30:00Z",
  "parentVersionId": "450e8400-e29b-41d4-a716-446655440000",
  "contentHash": "sha256:abc123...",
  "isDeleted": false,
  "restoredFrom": null,
  "gitCommitSha": "a1b2c3d4..." // Only for GitHub storage
}
```

### DynamoDB Usage (Optional)

DynamoDB is **optional** for all storage backends:
- Metadata files are the source of truth
- DynamoDB can be used as performance optimization cache
- If used, sync from metadata files on read
- Not required for MVP

### Diff Algorithm

Use established diff libraries:
- **Backend**: `diff` npm package (Myers diff algorithm) or `fast-diff`
- **Frontend**: `react-diff-viewer` or `monaco-diff-editor` components
- Compute diffs on backend for security (don't expose full version content to unauthorized users)

### Performance Optimization

- Lazy load version content only when viewing/comparing (metadata loads first)
- Use content hashing to detect identical versions (skip redundant storage)
- Implement pagination for version lists (20 per page)
- Virtualize diff rendering for large changes
- Caching strategy deferred to post-MVP based on actual performance data

### Cost Analysis

Monthly cost estimates for typical family wiki (100 pages, average 10 versions per page):

**S3 Storage (using explicit version files)**
- 1,000 total version files × 10KB average = 10MB
- 1,000 metadata files × 1KB = 1MB
- Total: 11MB storage
- S3 storage: $0.023/GB = ~$0.0003/month
- GET requests: 100 history views/month × $0.0004/1000 = negligible
- **Total: <$0.01/month**

**DynamoDB (optional caching layer)**
- If implemented: ~$0.01/month for metadata caching
- Not required for MVP
- **Total: $0 (not using in MVP)**

**GitHub Storage (using Git commits + metadata files)**
- Free for private repositories (unlimited commits)
- Metadata files stored in repo alongside content
- API rate limits: 5,000 requests/hour (sufficient for family wiki)
- **Total: $0/month**

**Overall impact**: Version history adds <$0.01/month to hosting costs, well within $5 constitutional target.

## UI/UX Considerations

### History View Layout

```
┌─────────────────────────────────────────────────────────┐
│  Page: "Family Recipes"                    [Edit] [History] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Version History                           [Export History] │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ☑ Version 12 - Current                          │   │
│  │   By: Alice Johnson | Jan 12, 2026, 3:45 PM      │   │
│  │   [View] [Compare ▼]                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ☐ Version 11                                     │   │
│  │   By: Bob Smith | Jan 10, 2026, 2:30 PM          │   │
│  │   [View] [Compare ▼] [⚡Compare with current]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ... (more versions)                                     │
│                                                           │
│  [← Previous 20] [1] [2] [3] [Next 20 →]                 │
└─────────────────────────────────────────────────────────┘
```

### Diff View Layout

```
┌─────────────────────────────────────────────────────────┐
│  Comparing Version 11 (Jan 10) → Version 12 (Jan 12)    │
│  [◀ Back to History] [Side-by-Side ▼] [Export Diff]     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Version 11 (Bob Smith)          Version 12 (Alice)      │
│  ┌──────────────────────┐      ┌──────────────────────┐ │
│  │ # Family Recipes      │      │ # Family Recipes      │ │
│  │                       │      │                       │ │
│  │ ## Banana Bread       │      │ ## Banana Bread       │ │
│  │                       │      │                       │ │
│  │ 1. Mix flour          │      │ 1. Mix flour          │ │
│  │ 2. Add eggs           │      │ 2. Add eggs           │ │
│  │ 3. Bake at 350°F      │      │ 3. Bake at 350°F      │ │
│  │                       │      │                       │ │
│  │                       │      │ + ## Chocolate Chip   │ │
│  │                       │      │ +                     │ │
│  │                       │      │ + 1. Cream butter     │ │
│  │                       │      │ + 2. Add chocolate    │ │
│  └──────────────────────┘      └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Mobile Considerations

- Stack version cards vertically (single column)
- Use expandable/collapsible version details
- Swipe gestures for navigating between versions
- Simplified diff view (unified format only on mobile)
- Touch-friendly restore button with confirmation

### Accessibility

- Keyboard navigation: Tab through version entries, Enter to view
- Screen reader: Announce version number, author, date, and description
- Color contrast: Ensure green/red diff colors meet WCAG AA (4.5:1 minimum)
- Alternative to color: Use +/- symbols in addition to color coding
- Focus indicators: Clear outline on focused version entry

## Open Questions

**Note**: Most questions have been resolved through the clarification process (see `clarifications.md`). Remaining questions:

1. **Version retention enforcement**: How should the system enforce configurable retention policies? (Suggested: Background cleanup job runs daily/weekly to remove old versions beyond limit)

2. **Anonymous edits**: Can system track versions if authentication is somehow bypassed or for system-generated changes? (Suggested: Require authentication always per constitution, use system user ID for automated changes)

3. **Attachment versioning**: Should attachments have their own version history separate from page content? (Suggested: Phase 2 feature, noted in edge cases)

4. **Version diff granularity**: Should diffs be line-based, word-based, or character-based? (Suggested: Line-based for MVP, word-based for future enhancement)

5. **Bulk operations**: Should users be able to restore or export multiple pages' history at once? (Suggested: Phase 2 feature)

6. **Version search**: Should users be able to search within historical versions to find when specific content existed? (Suggested: Phase 2 feature)

## Future Enhancements (Post-MVP)

- **Export functionality**: Export individual versions or complete history to markdown/JSON/CSV
- **Attachment versioning**: Track version history for file attachments separately
- **Version annotations**: Allow users to add comments/notes to specific versions
- **Version tagging**: Label important versions as "Release 1.0", "Draft", "Approved", etc.
- **Advanced search**: Search across all historical versions to find when content existed
- **Version branching**: Create alternate versions/drafts without affecting main page (wiki "branches")
- **Automated versioning**: Auto-save versions at configurable intervals (hourly, daily)
- **Version comparison with arbitrary external files**: Compare page version against uploaded .md file
- **Enhanced conflict resolution**: Multi-user merge tools with three-way diff for resolving concurrent edit conflicts
- **Version analytics**: Report on most edited pages, most active contributors, edit patterns over time
- **Scheduled restore**: Restore page to specific version at scheduled time (useful for temporary changes)
- **Performance caching**: Implement version content caching if costs or performance degrade
- **Monthly snapshots**: Automatically tag monthly versions for long-term retention beyond normal limits

---

## Design Decisions Summary

This section documents key architectural and UX decisions made during the clarification process (2026-01-13). See `clarifications.md` for detailed rationale.

### Architecture Decisions

1. **Version Storage**: Explicit version files (not S3/GitHub native versioning)
   - Each version stored as separate `.md` file: `pages/{pageId}/versions/v{N}.md`
   - Platform-agnostic approach ensures consistency across storage backends
   
2. **Metadata Storage**: JSON metadata files alongside content
   - Each version has corresponding `.meta.json` file with all metadata
   - Eliminates dependency on DynamoDB for MVP
   - Source of truth for version information regardless of storage backend

3. **Version Identification**:
   - **Version IDs**: GUIDs for universal uniqueness
   - **Version Numbers**: Sequential integers stored in metadata
   - GitHub commit SHAs stored as reference in metadata but not primary identifier

4. **DynamoDB Usage**: Optional (not required for MVP)
   - Can be added as performance cache layer if needed
   - Metadata files are authoritative source

5. **Concurrent Edit Detection**: Optimistic locking with ETags
   - ETag/version token checked on save
   - Conflict detected via mismatch triggers side-by-side comparison UI

### Feature Scope Decisions

6. **Change Descriptions**: REMOVED from MVP
   - Simplifies save flow (no modal/dialog on every save)
   - Reduces metadata storage and complexity
   - Can be added in Phase 2 if user feedback indicates need

7. **Export Functionality**: Deferred to post-MVP
   - Individual version export not in MVP
   - History export (JSON/CSV) not in MVP
   - Permalinks included for viewing versions

8. **Performance Requirements**: Monitor and optimize post-MVP
   - No hard timing requirements (2s, 3s, 5s) enforced in MVP
   - Measure actual performance and optimize if issues arise
   - Caching strategy deferred until data shows need

### User Experience Decisions

9. **Deleted Pages**: Soft delete with "Recently Deleted" UI
   - Pages marked as deleted in metadata (not actually removed)
   - Accessible through dedicated UI section for recovery
   - Permanent delete removes both content and metadata files

10. **Version Retention**: Configurable per-wiki
    - Default: unlimited retention
    - Admins can set retention policies (e.g., "keep last 100 versions")
    - Automatic cleanup when limits reached

11. **Permissions**: View permission required for history access
    - Same permission to view history as to view current page
    - Edit permission required to restore versions
    - Permission loss revokes all history access (not just restore)

12. **Permalinks**: RESTful URLs with required authentication
    - Format: `/pages/{pageId}/versions/{versionId}` (GUIDs)
    - Authentication always required (no time-limited tokens)
    - No public share links in MVP

### Implementation Notes

- **Conflict Resolution**: Side-by-side comparison UI for manual merge
- **No Staleness Threshold**: Conflict detection based solely on ETag mismatch, not time-based
- **Platform Consistency**: All backends use same metadata file format and structure
- **Git Integration**: For GitHub storage, sync commit metadata to `.meta.json` files

**Status**: All high and medium priority clarifications resolved. Spec ready for implementation planning.
