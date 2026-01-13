# Feature Specification: Page Navigation & Discovery

**Feature Branch**: `10-navigation-discovery`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Page Navigation & Discovery - Sitemap/table of contents generation, Recent changes/activity feed, Breadcrumb navigation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Breadcrumb Navigation (Priority: P1)

A user views any page and sees a breadcrumb trail showing the page's position in the wiki hierarchy, with clickable links to navigate up through parent pages to the root.

**Why this priority**: Breadcrumbs are essential for orientation in hierarchical wikis. Users need to understand where they are and easily navigate up the hierarchy. The constitution explicitly requires hierarchical structure and mentions breadcrumb navigation.

**Independent Test**: Navigate to a deeply nested page like "Projects/2024/Q4/Planning", verify breadcrumbs show "Home > Projects > 2024 > Q4 > Planning" with each segment clickable, click "Projects" and confirm navigation to that folder.

**Acceptance Scenarios**:

1. **Given** a page at path "/Projects/2024/Q4/Planning", **When** the page loads, **Then** breadcrumbs display "Home > Projects > 2024 > Q4 > Planning" with each segment as a clickable link
2. **Given** breadcrumb navigation, **When** a user clicks any parent segment, **Then** they navigate to that folder/page view
3. **Given** a root-level page, **When** viewed, **Then** breadcrumbs show only "Home > [Page Name]" with Home linking to the wiki root
4. **Given** long folder/page names, **When** displayed in breadcrumbs, **Then** names are truncated with ellipsis if exceeding 30 characters with full name shown on hover
5. **Given** breadcrumbs on mobile devices, **When** screen width is constrained, **Then** breadcrumbs collapse to show only the last 2 segments with a "..." menu for earlier segments

---

### User Story 2 - Page Table of Contents (Auto-Generated) (Priority: P1)

A user viewing a long page sees an auto-generated table of contents sidebar that lists all headings (H2-H4) from the page content, with clickable links that scroll to each section.

**Why this priority**: Long pages need internal navigation to be usable. Auto-generating TOC from markdown headings provides immediate value without requiring authors to manually maintain it.

**Independent Test**: Create a page with markdown headings (# Main, ## Section 1, ### Subsection 1.1, ## Section 2), view the page, and verify the TOC sidebar shows nested heading structure with working anchor links.

**Acceptance Scenarios**:

1. **Given** a page with markdown headings, **When** the page renders, **Then** a TOC is automatically generated from H2 (##) through H4 (####) headings
2. **Given** the auto-generated TOC, **When** displayed, **Then** it shows a nested/indented structure reflecting heading hierarchy (H2 parent, H3 child, H4 grandchild)
3. **Given** TOC entries, **When** a user clicks a heading link, **Then** the page smoothly scrolls to that section with the heading highlighted momentarily
4. **Given** a page with fewer than 3 headings, **When** rendered, **Then** the TOC is not displayed (too short to need navigation aid)
5. **Given** the page is scrolled, **When** passing different sections, **Then** the corresponding TOC entry is highlighted to show current position
6. **Given** TOC on mobile devices, **When** screen width is narrow, **Then** TOC is collapsed by default with a "Contents" button to expand it as an overlay

---

### User Story 3 - Recent Changes/Activity Feed (Priority: P1)

A user accesses a "Recent Changes" page showing a chronological list of all wiki edits, page creations, and deletions across the entire wiki, helping users discover new content and track activity.

**Why this priority**: Activity feed is a core wiki feature that enables collaboration awareness. Users need to see what's changed since their last visit. Essential for family wikis where members want to stay updated.

**Independent Test**: Create 2 new pages and edit 3 existing pages, navigate to "Recent Changes" page, and verify all 5 activities are listed chronologically with timestamps, page names, authors, and links to view the pages.

**Acceptance Scenarios**:

1. **Given** a "Recent Changes" page, **When** loaded, **Then** it displays a chronological list (newest first) of page modifications, creations, and deletions
2. **Given** each activity entry, **When** displayed, **Then** it shows: timestamp (relative, e.g., "2 hours ago"), page title (linked), author name, and action type (created/edited/deleted)
3. **Given** the activity feed, **When** a page has been edited multiple times, **Then** optionally group sequential edits by the same author within 1 hour with "3 edits" label
4. **Given** recent changes list, **When** displayed, **Then** pagination shows 50 entries per page with "Load More" or numbered pagination
5. **Given** deleted pages in the activity feed, **When** shown, **Then** the page title is displayed but not linked, with strike-through styling and "(deleted)" label
6. **Given** activity feed data, **When** retrieved, **Then** it queries the storage plugin's page history/metadata or maintains a separate activity log in DynamoDB

---

### User Story 4 - Wiki Sitemap (Full Page Hierarchy) (Priority: P2)

A user accesses a "Sitemap" page that shows the entire wiki structure as a hierarchical tree view, with all folders and pages displayed in an expandable/collapsible outline.

**Why this priority**: Sitemap provides a bird's-eye view of wiki structure, helpful for large wikis but not essential for small family wikis. Activity feed and breadcrumbs cover most navigation needs for MVP.

**Independent Test**: Create a wiki structure with 3 folders and 10 pages at various depths, navigate to sitemap page, and verify the entire hierarchy is displayed as an expandable tree with folder/page icons and links.

**Acceptance Scenarios**:

1. **Given** a sitemap page, **When** loaded, **Then** the entire wiki hierarchy is displayed as an expandable tree starting from root folders and pages
2. **Given** the sitemap tree, **When** displayed, **Then** folders show with folder icon and expand/collapse arrows, pages show with document icon
3. **Given** collapsed folders in sitemap, **When** a user clicks the expand arrow, **Then** child folders and pages are revealed without page reload
4. **Given** sitemap entries, **When** clicked, **Then** the user navigates to that folder/page view in the wiki
5. **Given** a large wiki (100+ pages), **When** sitemap loads, **Then** it initially shows root level only with lazy loading of children on expand to maintain performance
6. **Given** sitemap structure, **When** generated, **Then** it retrieves hierarchy data from DynamoDB page metadata or queries the storage plugin's list operations

---

### User Story 5 - Filter Recent Changes by Criteria (Priority: P2)

A user filters the recent changes feed by date range, author, or page/folder to focus on specific activity rather than seeing all changes.

**Why this priority**: Filtering enhances the activity feed but isn't essential for MVP. Users can scroll/search through the unfiltered list as a workaround for small wikis.

**Independent Test**: Open recent changes page, apply filter "Last 7 days" and "Author: Mom", verify only changes from that author in the past week are displayed, clear filters and verify all changes return.

**Acceptance Scenarios**:

1. **Given** the recent changes page, **When** filter controls are displayed, **Then** users see dropdowns/inputs for: date range (today/week/month/custom), author (dropdown of all users), and folder (dropdown of folders)
2. **Given** a date range filter, **When** applied, **Then** only activities within that time window are displayed
3. **Given** an author filter, **When** applied, **Then** only changes by that specific user are shown
4. **Given** a folder filter, **When** applied, **Then** only changes to pages within that folder (and subfolders) are shown
5. **Given** multiple filters active, **When** applied together, **Then** results match ALL filter criteria (AND logic)
6. **Given** filters applied, **When** user clicks "Clear Filters", **Then** all filters reset and full unfiltered activity feed is displayed

---

### User Story 6 - RSS/Atom Feed for Recent Changes (Priority: P3)

A user subscribes to an RSS or Atom feed of recent wiki changes, allowing them to monitor activity using their preferred feed reader without logging into the wiki.

**Why this priority**: RSS feeds are convenient for power users but not essential. Most family members will check the wiki directly. Nice-to-have for those who prefer feed readers.

**Independent Test**: Navigate to recent changes page, locate RSS feed link, subscribe in a feed reader (e.g., Feedly), make wiki changes, and verify new entries appear in the feed reader.

**Acceptance Scenarios**:

1. **Given** the recent changes page, **When** loaded, **Then** an RSS feed icon/link is displayed in the page header or footer
2. **Given** the RSS feed URL, **When** accessed, **Then** it returns valid XML in Atom or RSS 2.0 format with recent changes as feed entries
3. **Given** each feed entry, **When** generated, **Then** it includes: title (page name + action), link to page, author name, timestamp, and brief description/summary
4. **Given** the RSS feed, **When** queried, **Then** it includes the most recent 50 changes to keep feed size manageable
5. **Given** authentication requirements, **When** accessing the feed, **Then** it requires authentication token in URL query parameter (e.g., `?token=user-rss-token`) for private wikis
6. **Given** feed generation, **When** triggered, **Then** the system caches the feed XML for 5-15 minutes to avoid regenerating on every request

---

### User Story 7 - Search Within Sitemap/Navigation (Priority: P3)

A user searches within the sitemap or navigation tree to quickly find and jump to a specific page by name without manually browsing the hierarchy.

**Why this priority**: Search functionality is already covered by the main wiki search feature (spec 7). Sitemap-specific search is a convenience but not essential for MVP.

**Independent Test**: Open sitemap page, type "holiday" in the search box, and verify matching pages/folders are highlighted in the tree or shown in a filtered list.

**Acceptance Scenarios**:

1. **Given** the sitemap page, **When** a search input is available, **Then** users can type page/folder names to filter the displayed tree
2. **Given** a search query entered, **When** processing, **Then** matching pages/folders are highlighted or the tree is filtered to show only matches and their parents
3. **Given** search results in sitemap, **When** displayed, **Then** matched text is highlighted and irrelevant branches are hidden or dimmed
4. **Given** an empty search query, **When** cleared, **Then** the full sitemap tree is restored to its original expanded/collapsed state
5. **Given** sitemap search, **When** using the main wiki search instead, **Then** users can achieve the same goal, making this feature optional

---

### User Story 8 - "What Links Here" (Backlinks View) (Priority: P2)

A user viewing a page sees a list of other pages that link to the current page, helping discover related content and understand page relationships.

**Why this priority**: Backlinks are valuable for discovering connections but not essential for MVP. They require additional indexing infrastructure and can be added later when the wiki has substantial content.

**Independent Test**: Create page A, create pages B and C with links to page A, view page A, and verify a "What Links Here" section shows pages B and C as backlinks.

**Acceptance Scenarios**:

1. **Given** a page is being viewed, **When** the page loads, **Then** a "What Links Here" section is displayed showing pages that link to this page
2. **Given** backlinks exist, **When** displayed, **Then** each linking page is shown with its title (linked), folder path, and optionally a snippet of context showing the link
3. **Given** no pages link to the current page, **When** backlinks section loads, **Then** it displays "No pages link to this page yet"
4. **Given** backlinks data, **When** queried, **Then** the system retrieves link relationships from DynamoDB link index (maintained by page link parser)
5. **Given** a page with many backlinks (20+), **When** displayed, **Then** pagination shows 10 backlinks per page with "Show More" option
6. **Given** backlinks infrastructure, **When** pages are edited, **Then** the link index is updated to maintain accurate backlink data

---

### Edge Cases

- **What happens when a folder/page is renamed?** Breadcrumbs and sitemap must update to reflect new names. Backlinks remain valid if using GUID-based links.
- **How does the system handle very deep hierarchies (10+ levels)?** Breadcrumbs collapse older segments into dropdown menu. Sitemap uses lazy loading for deep branches.
- **What if recent changes includes thousands of entries?** Implement pagination and filtering. Consider archiving old activity data after 90 days to separate table.
- **How are deleted pages handled in backlinks?** Backlinks to deleted pages show with "(deleted)" label and strike-through, no navigation link.
- **What happens when page headings contain special characters?** TOC anchor generation sanitizes special chars to create valid HTML IDs (e.g., spaces to hyphens).
- **How does TOC handle duplicate heading text?** Append numeric suffix to anchor IDs (e.g., `#introduction-1`, `#introduction-2`).
- **What if a page has no headings?** TOC is not displayed. User sees normal page content without TOC sidebar.
- **How does activity feed perform with concurrent edits?** Use DynamoDB timestamp-based queries with eventual consistency acceptable for activity feed.
- **What if sitemap generation times out for massive wikis (1000+ pages)?** Implement lazy loading, load root level first, fetch children on demand. Consider caching full sitemap structure.
- **How are permissions handled in navigation features?** Users only see pages/folders they have permission to view. Sitemap, backlinks, and activity feed filter by user role.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate breadcrumb navigation from page hierarchy metadata, displaying path from root to current page
- **FR-002**: System MUST automatically extract H2-H4 headings from rendered markdown to generate table of contents with anchor links
- **FR-003**: System MUST provide a "Recent Changes" page displaying chronological activity feed of page creations, edits, and deletions
- **FR-004**: System MUST capture activity metadata including: timestamp, page title, author, action type (create/edit/delete)
- **FR-005**: System MUST provide a "Sitemap" page showing full wiki hierarchy as expandable tree view
- **FR-006**: System MUST retrieve page hierarchy data from DynamoDB or storage plugin to populate sitemap and breadcrumbs
- **FR-007**: System MUST make breadcrumb segments clickable links that navigate to parent folders/pages
- **FR-008**: System MUST highlight current section in TOC as user scrolls through page content
- **FR-009**: System MUST support pagination for recent changes feed (50 entries per page minimum)
- **FR-010**: System MUST filter recent changes by date range, author, and folder when filters are applied
- **FR-011**: System MUST display TOC only for pages with 3 or more headings to avoid clutter
- **FR-012**: System MUST generate valid anchor IDs for TOC links handling special characters and duplicates
- **FR-013**: System MUST respect user permissions in all navigation features (users only see pages they can access)
- **FR-014**: System MUST provide responsive mobile layouts for breadcrumbs (collapsed) and TOC (overlay/expandable)
- **FR-015**: System SHOULD provide backlinks ("What Links Here") by querying link index in DynamoDB
- **FR-016**: System SHOULD generate RSS/Atom feed for recent changes with authentication token for private wikis
- **FR-017**: System SHOULD cache sitemap structure for 5-15 minutes to optimize performance for repeated access
- **FR-018**: System SHOULD use lazy loading for sitemap children in large wikis (100+ pages) to avoid timeout

### Key Entities

- **Breadcrumb**: Visual navigation component showing hierarchy path
  - Segments: Array of {name, path, isClickable}
  - CurrentPage: Final segment (not clickable)
  - Responsive: Boolean for collapsed mobile view

- **TableOfContents**: Auto-generated from page headings
  - Entries: Array of {level (H2/H3/H4), text, anchorId}
  - IsVisible: Boolean (true if 3+ headings)
  - CurrentSection: Highlighted entry based on scroll position

- **ActivityEntry**: Record of wiki change for recent changes feed
  - Timestamp: ISO datetime of action
  - PageId: GUID of affected page
  - PageTitle: Display name of page
  - Author: User who made the change
  - ActionType: Enum (created, edited, deleted, renamed, moved)
  - FolderPath: Hierarchical path for filtering

- **SitemapNode**: Tree structure element for full wiki hierarchy
  - Id: Page/folder GUID
  - Name: Display name
  - Type: Enum (folder, page)
  - Children: Array of child SitemapNodes
  - IsExpanded: Boolean for UI state
  - Path: Full hierarchical path

- **Backlink**: Reference to page that links to current page
  - SourcePageId: GUID of linking page
  - SourcePageTitle: Display name
  - SourcePagePath: Folder path
  - LinkContext: Text snippet showing the link (optional)

## Technical Implementation Notes

### Data Storage

**DynamoDB Tables/Indexes**:
- **PageMetadata table**: Already exists for page hierarchy
  - Add GSI for `modified` timestamp to enable recent changes queries
  - Attributes: `pageId` (PK), `path`, `title`, `parentId`, `created`, `modified`, `author`

- **ActivityLog table** (optional optimization):
  - PK: `activityId` (ULID for time-ordered IDs)
  - SK: `timestamp` (for chronological sorting)
  - Attributes: `pageId`, `pageTitle`, `author`, `action`, `folderPath`
  - GSI-1: `author-timestamp-index` for filtering by author
  - GSI-2: `folderPath-timestamp-index` for filtering by folder
  - Consideration: Keep last 90 days in hot table, archive older to S3 for cost optimization

- **LinkIndex table**: For backlinks feature
  - PK: `targetPageId` (page being linked to)
  - SK: `sourcePageId` (page containing the link)
  - Attributes: `sourcePageTitle`, `sourcePagePath`, `linkContext`
  - Updated whenever page content is saved (parse markdown links)

### Frontend Components

**Breadcrumb Component** (`<Breadcrumb />`):
- Props: `currentPath` (string), `pageTitle` (string)
- Parses path into segments and renders linked trail
- Responsive: Collapses to last 2 segments on mobile with dropdown

**TableOfContents Component** (`<TOC />`):
- Props: `markdownContent` (string) or `headings` (array)
- Extracts headings using markdown parser or regex
- Generates anchor IDs (slug + dedupe logic)
- Implements scroll spy to highlight current section
- Renders as fixed sidebar on desktop, expandable overlay on mobile

**RecentChanges Page** (`<RecentChangesPage />`):
- Fetches activity data from API: `GET /api/activity?page=1&limit=50`
- Filter controls: DateRangePicker, UserDropdown, FolderDropdown
- Renders activity entries with relative timestamps (e.g., "2 hours ago")
- Pagination component at bottom

**Sitemap Page** (`<SitemapPage />`):
- Fetches hierarchy data: `GET /api/sitemap` (full tree or root only)
- Recursive tree component with expand/collapse for folders
- Lazy loading: Fetch children on expand for large wikis
- Search input filters tree in real-time (client-side)

**BacklinksSection Component** (`<Backlinks />`):
- Props: `pageId` (GUID)
- Fetches backlinks from API: `GET /api/pages/:pageId/backlinks`
- Renders list of linking pages with snippets

### Backend API Endpoints

**GET /api/activity**:
- Query params: `?page=1&limit=50&dateRange=week&author=userId&folder=folderPath`
- Returns: `{ activities: ActivityEntry[], totalCount: number, hasMore: boolean }`
- Implementation: Query DynamoDB ActivityLog table with filters

**GET /api/sitemap**:
- Returns: Full hierarchy tree or root level nodes
- Option: Query param `?depth=1` to limit depth for lazy loading
- Implementation: Query DynamoDB PageMetadata table, construct tree structure

**GET /api/pages/:pageId/backlinks**:
- Returns: `{ backlinks: Backlink[] }`
- Implementation: Query DynamoDB LinkIndex table with PK = targetPageId

**GET /api/activity/feed.xml** (RSS feed):
- Query params: `?token=user-rss-token` for authentication
- Returns: XML in Atom or RSS 2.0 format
- Implementation: Generate XML from recent activity entries, cache for 15 minutes

### Performance Considerations

- **TOC Generation**: Parse markdown on client-side after render to avoid backend overhead
- **Breadcrumbs**: Construct from page path in frontend, no backend query needed
- **Activity Feed**: Cache recent 50 entries in DynamoDB with TTL, refresh every 5 minutes
- **Sitemap**: Cache full tree structure in backend for 15 minutes (CloudFront or Lambda layer)
- **Backlinks**: Update link index asynchronously after page save (Lambda background job)
- **Mobile Performance**: Use intersection observer for TOC scroll spy, throttle to 100ms

### Accessibility (WCAG 2.1 AA Compliance)

- **Breadcrumbs**: Use `<nav aria-label="Breadcrumb">` with `<ol>` list structure
- **TOC**: Use `<nav aria-label="Table of Contents">` with semantic heading structure
- **Activity Feed**: Each entry has proper heading hierarchy and timestamp in accessible format
- **Sitemap**: Use ARIA tree roles (`role="tree"`, `role="treeitem"`) with expand/collapse state
- **Keyboard Navigation**: All interactive elements (links, expand/collapse) are keyboard accessible
- **Screen Readers**: Announce current breadcrumb position and TOC section changes

### Mobile Responsive Behavior

- **Breadcrumbs**: Show only last 2 segments on mobile (<768px), earlier segments in dropdown
- **TOC**: Collapsed by default on mobile, "Contents" button expands as overlay/modal
- **Activity Feed**: Stack entries vertically, reduce metadata display (hide folder path)
- **Sitemap**: Touch-friendly expand/collapse targets (44px min), swipe gestures for navigation

## Alignment with Constitution

**Pluggable Module Architecture**:
- Navigation features are NOT plugins but core functionality required by hierarchical structure principle
- However, activity logging could be optional module (basic vs. advanced activity tracking)

**Content-First Architecture**:
- All navigation derives from page metadata and content (headings for TOC)
- No separate navigation configuration needed - emerges from content structure

**Simplicity & Cost-Effectiveness**:
- DynamoDB queries for activity feed and sitemap are inexpensive (on-demand pricing)
- Caching strategies minimize repeated queries for static data (sitemap)
- ActivityLog table with TTL keeps costs low by auto-deleting old entries

**Family-Friendly Experience**:
- Breadcrumbs and TOC make navigation intuitive for all ages
- Recent changes helps family members discover new content
- Mobile-responsive design ensures access from phones/tablets

**Hierarchical Page Structure**:
- Breadcrumbs and sitemap directly expose the Confluence-style parent-child relationships required by constitution
- Navigation features reinforce the hierarchical mental model

**WCAG 2.1 AA Compliance**:
- All navigation components use semantic HTML and ARIA labels
- Keyboard navigation and screen reader support throughout

## Testing Strategy

### Unit Tests
- TOC generation from markdown headings (various heading levels, special chars, duplicates)
- Breadcrumb path parsing and segment construction
- Activity entry filtering logic (date range, author, folder)
- Sitemap tree construction from flat page list
- Anchor ID generation with deduplication

### Integration Tests
- API endpoint `/api/activity` returns paginated results with correct filters
- API endpoint `/api/sitemap` returns valid hierarchy tree
- API endpoint `/api/pages/:pageId/backlinks` returns correct linking pages
- DynamoDB queries for activity log retrieve expected entries
- Link index updates when page content changes

### End-to-End Tests
- User navigates from deep page to root via breadcrumbs
- User clicks TOC entry and page scrolls to correct section
- User filters recent changes and sees filtered results
- User expands sitemap folders and navigates to page
- User views backlinks and clicks to navigate to linking page

### Accessibility Tests
- Screen reader announces breadcrumb position correctly
- Keyboard navigation through TOC using Tab and Enter
- ARIA tree roles in sitemap work with assistive technology
- Color contrast meets WCAG AA standards for all navigation UI

### Performance Tests
- Sitemap loads within 2 seconds for wiki with 500 pages
- TOC generation and scroll spy has no noticeable lag
- Activity feed pagination loads next page within 500ms
- Backlinks query returns results within 1 second

## Open Questions

1. **Activity Log Retention**: Keep 90 days in DynamoDB then archive to S3, or retain all in DynamoDB with lifecycle policy?
2. **Link Index Maintenance**: Update synchronously on page save (blocking) or asynchronously (eventually consistent backlinks)?
3. **Sitemap Caching Strategy**: Cache in CloudFront (CDN), Lambda layer, or DynamoDB with TTL?
4. **TOC Heading Levels**: Include only H2-H3 (cleaner) or H2-H4 (more comprehensive)?
5. **RSS Feed Authentication**: Use per-user tokens or single shared token for private wikis?
6. **Activity Feed Grouping**: Group sequential edits by same author within 1 hour or show every edit separately?
7. **Mobile TOC Behavior**: Overlay modal or inline expandable section?

## Dependencies

- **Spec 3 (Folder Management)**: Provides folder hierarchy for breadcrumbs and sitemap
- **Spec 4 (Page Editor)**: Saves pages triggering activity log entries
- **Spec 5 (Page Links)**: Link parser provides data for link index and backlinks
- **Spec 9 (Page History)**: Could integrate with activity feed to show version details

## Success Metrics

- **Breadcrumbs**: 80%+ of navigation sessions use breadcrumb links to move up hierarchy
- **TOC**: 60%+ of views on pages with 3+ headings interact with TOC (click or scroll)
- **Activity Feed**: 70%+ of users visit Recent Changes within first week of wiki usage
- **Sitemap**: 40%+ of users explore sitemap to discover pages they didn't know existed
- **Backlinks**: 50%+ of pages with 5+ backlinks have at least one backlink clicked per month
- **Performance**: P95 latency for all navigation API endpoints under 1 second
- **Mobile Usage**: 30%+ of navigation feature usage occurs on mobile devices
