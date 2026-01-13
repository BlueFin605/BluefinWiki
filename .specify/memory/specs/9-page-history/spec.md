# Feature Specification: Page History & Version Management

**Feature Branch**: `9-page-history`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "How users view page history, compare versions, and restore previous versions: View page version history, Compare two versions (diff view), Restore previous version, Track who made what changes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Page Version History (Priority: P1)

A user views the complete version history of a wiki page to understand how the page has evolved over time, seeing a chronological list of all changes with timestamps, authors, and change summaries.

**Why this priority**: Version history is a constitutional requirement ("Version history and 'undo' capabilities") and provides essential audit trail for collaborative wikis. Families need to see who changed what and when, especially for important information.

**Independent Test**: Create a page, edit it 3 times with different users, navigate to "History" view, and verify all 3 versions are listed with correct timestamps, authors, and version numbers.

**Acceptance Scenarios**:

1. **Given** a user views any wiki page, **When** they click the "History" button in the toolbar, **Then** they see a chronological list of all page versions from newest to oldest
2. **Given** the history view is displayed, **When** viewing a version entry, **Then** each entry shows: version number, timestamp, author name, and optional change summary/commit message
3. **Given** a page with 50+ versions, **When** viewing history, **Then** versions are paginated (20 per page) with navigation controls
4. **Given** a user views a version in the history list, **When** they click on that version, **Then** they are taken to a read-only preview of the page content at that point in time
5. **Given** a version preview, **When** displayed, **Then** a banner indicates "Viewing historical version [N] from [date]" with "Return to current version" button
6. **Given** the history view, **When** a page was created, **Then** the first version shows "Page created" as the change description
7. **Given** the history view, **When** storage plugin is S3, **Then** versions are retrieved from S3 object versions or separate version files
8. **Given** the history view, **When** storage plugin is GitHub, **Then** versions are retrieved from Git commit history for that file

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
4. **Given** a restore action, **When** successful, **Then** the new version's change summary indicates "Restored from version [N]" with automatic attribution
5. **Given** a restore action, **When** completed, **Then** the user is redirected to the current (newly restored) page view
6. **Given** a restored version, **When** viewing history, **Then** the restore appears as a new entry showing who performed the restore and when
7. **Given** a user attempts restore, **When** they lack edit permissions, **Then** the restore button is disabled with tooltip "Requires edit permission"
8. **Given** a restore in progress, **When** the storage plugin is S3, **Then** the content is written as a new S3 object version or versioned file
9. **Given** a restore in progress, **When** the storage plugin is GitHub, **Then** a new commit is created with message "Restored from version [commit-hash]"
10. **Given** a page with attachments, **When** restoring a version, **Then** attachments are NOT restored (only page content) with a warning message displayed

---

### User Story 4 - Track Author Attribution and Change Metadata (Priority: P2)

Users can see detailed metadata for each page version including who made changes, when, from what device/location (if available), and optional change descriptions that authors can provide when saving.

**Why this priority**: Attribution is essential for accountability in collaborative environments and helps families understand the context of changes. While important, it's secondary to core history/restore functionality.

**Independent Test**: Edit a page while logged in as "Alice", add change description "Updated meeting notes", save, then view history and verify Alice's name, timestamp, and change description appear correctly.

**Acceptance Scenarios**:

1. **Given** a user saves a page edit, **When** the save dialog appears, **Then** it includes an optional "Change description" text field
2. **Given** the change description field, **When** a user enters text (e.g., "Fixed typo in introduction"), **Then** this description is stored with the version metadata
3. **Given** the history view, **When** displaying versions, **Then** each entry shows the author's display name (not email) and change description if provided
4. **Given** a version with no change description, **When** displayed in history, **Then** it shows a default message like "Page updated" or "No description provided"
5. **Given** the history view, **When** a version is listed, **Then** clicking the author's name shows their profile or filters history to show only their changes
6. **Given** version metadata, **When** stored, **Then** it includes: version ID, parent version ID, author user ID, timestamp, change description, content hash
7. **Given** the page editor, **When** concurrent edits are detected, **Then** users are warned and can view the conflicting version before deciding to save
8. **Given** version metadata, **When** using S3 storage, **Then** metadata is stored in DynamoDB table `PageVersions` with pageId + versionId composite key
9. **Given** version metadata, **When** using GitHub storage, **Then** git commit metadata (author, message, timestamp, SHA) serves as version metadata
10. **Given** a restored version, **When** viewing its metadata, **Then** it shows both the restoring user and references the original version author

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

Users can export specific versions to markdown files or share permanent links to specific versions for reference, documentation, or archival purposes.

**Why this priority**: Export and permalinks are valuable for documentation workflows but not essential for MVP. Core history/restore features provide the primary value.

**Independent Test**: View version 5 of a page, click "Export this version", and verify a markdown file downloads with the content exactly as it appeared in version 5, including frontmatter with version metadata.

**Acceptance Scenarios**:

1. **Given** a historical version preview, **When** user clicks "Export version" button, **Then** a .md file downloads containing the page content as it appeared in that version
2. **Given** the exported file, **When** opened, **Then** YAML frontmatter includes version metadata: version number, date, author, and "exported_from" reference
3. **Given** any version preview, **When** user clicks "Copy permalink" button, **Then** a permanent URL to that specific version is copied to clipboard
4. **Given** a permalink to a historical version, **When** accessed by any user, **Then** they see the page content as it appeared in that version with historical context banner
5. **Given** permalinks, **When** generated, **Then** URL format is: `/pages/{pageId}/versions/{versionId}` or `/pages/{pageId}?version={versionId}`
6. **Given** the history view, **When** user clicks "Export history" button, **Then** a JSON or CSV file downloads containing all version metadata for that page

---

### Edge Cases

- **Concurrent edits**: What happens when two users edit the same page simultaneously? System must detect conflicts and allow manual resolution or force sequential saves with warning.
- **Large pages**: How does the system handle diff views for very large pages (10,000+ lines)? Must implement virtualization and lazy loading for performance.
- **Version limits**: Is there a maximum number of versions retained? Constitution doesn't specify; suggest unlimited for GitHub storage, configurable retention policy for S3 (e.g., keep last 100 versions + monthly snapshots).
- **Storage backend differences**: How are versions handled differently between S3 and GitHub? S3 uses S3 object versioning or separate version files; GitHub uses native Git commit history.
- **Deleted pages**: Can users view history of deleted pages? Should maintain history in archive table for recovery within retention period (e.g., 30 days).
- **Binary diffs**: How to show diffs when page contains embedded base64 images or other binary content? Show metadata change only, not binary diff.
- **First version**: What does "compare with previous" show for version 1? Disable the action or show creation metadata only.
- **Permission changes**: What if a user's permissions change after they created versions? History shows their attributed versions but they may not be able to restore if they lost edit permission.
- **Restore conflicts**: What if page was edited after user navigated to history but before restore? Show warning and offer to view latest version or force restore.
- **Attachment versioning**: This spec explicitly excludes attachment versioning (Story 3 acceptance #10). Future spec needed for attachment history.
- **GitHub rate limits**: For GitHub storage, rapid version queries might hit API rate limits. Must implement caching and batch requests.
- **Version ordering**: In distributed systems, are versions ordered by server timestamp or client timestamp? Use server timestamp for consistency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST retain complete version history for every page edit, storing: content, author, timestamp, and optional change description
- **FR-002**: System MUST display version history in reverse chronological order (newest first) with pagination for pages with 20+ versions
- **FR-003**: Users MUST be able to view read-only preview of any historical version by clicking it in the history list
- **FR-004**: System MUST provide diff/comparison view between any two page versions showing additions (green), deletions (red), and modifications
- **FR-005**: System MUST support both side-by-side and unified diff view formats, user-selectable
- **FR-006**: Users with edit permissions MUST be able to restore any previous version, creating a new version with the historical content
- **FR-007**: System MUST track version metadata including: version ID, author user ID, timestamp (UTC), change description, parent version ID
- **FR-008**: System MUST handle version storage differently per storage plugin:
  - **S3 Storage**: Use S3 object versioning OR store versions as separate files with naming convention `{pageGuid}/v{versionNumber}.md`
  - **GitHub Storage**: Use native Git commit history as version source with commits representing versions
- **FR-009**: System MUST prevent data loss: restore operations create new versions rather than overwriting history
- **FR-010**: System MUST display clear attribution for each version: author name, timestamp, and change description in history view
- **FR-011**: System MUST provide quick comparison actions: "Compare with current" and "Compare with previous" from history entries
- **FR-012**: System MUST detect concurrent edit conflicts and warn users before allowing save or restore operations
- **FR-013**: Users MUST be able to export individual historical versions as markdown files with version metadata in frontmatter
- **FR-014**: System MUST generate permanent URLs (permalinks) to specific page versions that remain accessible over time
- **FR-015**: System MUST respect user permissions for restore operations: only users with edit permissions can restore versions
- **FR-016**: System MUST optimize performance for large diffs by implementing virtualization for diffs exceeding 500 lines
- **FR-017**: System MUST preserve version history even when pages are deleted (archive for 30 days minimum)
- **FR-018**: Version history UI MUST be accessible via prominent "History" button in page toolbar/menu
- **FR-019**: System MUST indicate historical context clearly when viewing old versions with banner: "Viewing version [N] from [date]"
- **FR-020**: Restore confirmation dialog MUST clearly explain action and impact: "Creates new version with old content, preserves current in history"

### Key Entities

- **PageVersion**: Represents a specific snapshot of page content at a point in time
  - Attributes: versionId (GUID), pageId (GUID), versionNumber (integer), content (markdown text), authorUserId (GUID), timestamp (ISO 8601 UTC), changeDescription (optional text), parentVersionId (GUID), contentHash (SHA256), storageReference (S3 key or Git commit SHA)
  - Relationships: Belongs to Page, created by User, references parent PageVersion
  - Storage: DynamoDB table `PageVersions` with composite key (pageId, versionNumber) and GSI on (pageId, timestamp)

- **VersionComparison**: Transient entity representing diff between two versions
  - Attributes: fromVersionId, toVersionId, diffFormat (unified|sideBySide), changeBlocks (array of addition/deletion/modification regions)
  - Not persisted; computed on-demand from version content

- **RestoreAction**: Audit record of version restore operations
  - Attributes: restoreId (GUID), pageId, restoredFromVersionId, restoredToVersionId, restoringUserId, timestamp
  - Storage: Part of PageVersion metadata (change description includes restore reference)

### Non-Functional Requirements

- **NFR-001**: Version history retrieval MUST complete within 2 seconds for pages with up to 100 versions
- **NFR-002**: Diff computation and rendering MUST complete within 3 seconds for pages up to 5,000 lines
- **NFR-003**: Version restore operation MUST complete within 5 seconds including storage plugin write and DynamoDB metadata update
- **NFR-004**: System MUST maintain version history integrity with 99.99% durability (leveraging S3/GitHub durability guarantees)
- **NFR-005**: Version data storage overhead MUST NOT exceed 10% beyond raw content size (efficient metadata storage)
- **NFR-006**: History UI MUST be responsive and accessible, meeting WCAG 2.1 AA standards (per constitution)
- **NFR-007**: For S3 storage, version retention MUST leverage S3 lifecycle policies to manage storage costs per constitution cost targets

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view complete version history of any page and navigate to any historical version within 3 clicks
- **SC-002**: Users can identify what changed between any two versions within 30 seconds using diff view
- **SC-003**: Users can successfully restore a previous version to recover from unwanted changes in under 1 minute
- **SC-004**: 95% of version history operations (view, compare, restore) complete without errors or timeouts
- **SC-005**: Version attribution is accurate 100% of the time, showing correct author and timestamp for each change
- **SC-006**: Diff views accurately highlight all changes (additions, deletions, modifications) with zero false positives/negatives for standard markdown content
- **SC-007**: Storage costs for version history remain within constitutional $5/month target for typical family usage (estimated 100 pages, 10 versions per page average)
- **SC-008**: Users with non-technical backgrounds can successfully use history features without training or documentation 90% of the time

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
}
```

### S3 Storage Plugin Implementation

Two possible approaches for S3:

1. **S3 Object Versioning** (Recommended)
   - Enable versioning on S3 bucket
   - Each page save creates new object version automatically
   - Pros: Simple, leverages AWS built-in feature, reliable
   - Cons: Cannot add custom version metadata directly to S3 versions

2. **Explicit Version Files**
   - Store each version as separate file: `{pageGuid}/v{versionNumber}.md`
   - Pros: Full control over version metadata, can store in frontmatter
   - Cons: More complex, manual version management

Hybrid approach: Use S3 versioning for storage, DynamoDB for metadata and indexing.

### GitHub Storage Plugin Implementation

- Each page save creates a Git commit
- Commit SHA serves as versionId
- Commit message stores change description
- Git log provides version history
- Git diff provides comparison functionality
- Use GitHub API or local Git operations

### Version Metadata Storage

DynamoDB table design:

**Table: PageVersions**
- Partition Key: `pageId` (GUID)
- Sort Key: `versionNumber` (integer, auto-incrementing)
- Attributes:
  - `versionId` (GUID or Git SHA)
  - `timestamp` (ISO 8601 UTC)
  - `authorUserId` (GUID)
  - `authorName` (denormalized for performance)
  - `changeDescription` (text, optional)
  - `contentHash` (SHA256)
  - `storageReference` (S3 key or Git commit SHA)
  - `previousVersionId` (GUID or Git SHA)

**GSI: PageVersions_ByTimestamp**
- Partition Key: `pageId`
- Sort Key: `timestamp` (for chronological queries)

### Diff Algorithm

Use established diff libraries:
- **Backend**: `diff` npm package (Myers diff algorithm) or `fast-diff`
- **Frontend**: `react-diff-viewer` or `monaco-diff-editor` components
- Compute diffs on backend for security (don't expose full version content to unauthorized users)

### Performance Optimization

- Cache recent version metadata in memory (last 20 versions per page)
- Lazy load version content only when viewing/comparing
- Use content hashing to detect identical versions (skip redundant storage)
- Implement pagination for version lists (20 per page)
- Virtualize diff rendering for large changes

### Cost Analysis

Monthly cost estimates for typical family wiki (100 pages, average 10 versions per page):

**S3 Storage (using S3 versioning)**
- 1,000 total versions × 10KB average = 10MB
- S3 storage: $0.023/GB = ~$0.0002/month
- S3 version storage: Minimal (same as primary)
- GET requests: 100 history views/month × $0.0004/1000 = negligible
- **Total: <$0.01/month**

**DynamoDB (version metadata)**
- 1,000 version records × 1KB = 1MB
- On-demand storage: $0.25/GB = $0.00025/month
- Read requests: 100 queries/month × $0.25/million = negligible
- **Total: <$0.01/month**

**GitHub Storage (using Git commits)**
- Free for private repositories (unlimited commits)
- API rate limits: 5,000 requests/hour (sufficient for family wiki)
- **Total: $0/month**

**Overall impact**: Version history adds <$0.02/month to hosting costs, well within $5 constitutional target.

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
│  │   "Added chocolate chip cookie recipe"           │   │
│  │   [View] [Compare ▼]                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ☐ Version 11                                     │   │
│  │   By: Bob Smith | Jan 10, 2026, 2:30 PM          │   │
│  │   "Fixed typo in banana bread instructions"       │   │
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

1. **Version retention policy**: Should there be a configurable limit on number of versions retained for cost management? (Suggested: unlimited for GitHub, last 100 + monthly snapshots for S3)

2. **Change description requirement**: Should change descriptions be optional or required when saving edits? (Suggested: optional for MVP, required for certain page types/roles in future)

3. **Anonymous edits**: Can system track versions if authentication is somehow bypassed or for system-generated changes? (Suggested: require authentication always per constitution, use system user ID for automated changes)

4. **Attachment versioning**: Should attachments have their own version history separate from page content? (Suggested: Phase 2 feature, noted in edge cases)

5. **Version diff granularity**: Should diffs be line-based, word-based, or character-based? (Suggested: line-based for MVP, word-based for future enhancement)

6. **Bulk operations**: Should users be able to restore or export multiple pages' history at once? (Suggested: Phase 2 feature)

7. **Version search**: Should users be able to search within historical versions to find when specific content existed? (Suggested: Phase 2 feature)

8. **Conflict resolution UI**: What UI should be provided when concurrent edit conflicts are detected? (Suggested: Show both versions side-by-side, allow manual merge or choose winner)

## Future Enhancements (Post-MVP)

- **Attachment versioning**: Track version history for file attachments separately
- **Version annotations**: Allow users to add comments/notes to specific versions
- **Version tagging**: Label important versions as "Release 1.0", "Draft", "Approved", etc.
- **Advanced search**: Search across all historical versions to find when content existed
- **Version branching**: Create alternate versions/drafts without affecting main page (wiki "branches")
- **Automated versioning**: Auto-save versions at configurable intervals (hourly, daily)
- **Version comparison with arbitrary external files**: Compare page version against uploaded .md file
- **Collaborative conflict resolution**: Multi-user merge tools for resolving concurrent edit conflicts
- **Version analytics**: Report on most edited pages, most active contributors, edit patterns over time
- **Scheduled restore**: Restore page to specific version at scheduled time (useful for temporary changes)
