# Clarification Questions: Page Navigation & Discovery

**Feature**: Page Navigation & Discovery  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Breadcrumb Path Generation
**Question**: How are breadcrumbs generated from the page hierarchy?

**Current spec shows**: "Home > Projects > 2024 > Q4 > Planning"

**ANSWERED**: Breadcrumbs use short-code GUID URLs
- Each breadcrumb segment links to: `/pages/{short-code}/Display Name`
- Hierarchy determined by folder structure in S3
- URL mapping service resolves short-codes to S3 paths
- When pages/folders are moved, breadcrumbs update automatically (short-codes unchanged)
- Breadcrumbs can be generated from cached metadata for performance
- Deleted parent folders/pages handled gracefully (show "[Deleted]" or skip)

---

### 2. Table of Contents Heading Extraction
**Question**: How are headings extracted from markdown for TOC generation?

**ANSWERED**: Server-side generation using standard markdown parser
- Server-side generation: Storage plugin parses markdown during page render
- Use existing markdown parser (markdown-it, marked, or similar)
- Heading IDs: Slugify heading text ("My Section" → "my-section")
- Duplicate handling: Append numeric suffix ("intro", "intro-2", "intro-3")
- Cache TOC with rendered HTML for performance
- Maximum depth: H1-H4 (configurable)

---

### 3. Recent Changes Data Source
**Question**: Where does recent changes activity data come from?

**ANSWERED**: Hybrid approach - DynamoDB index with S3 fallback
- Primary: DynamoDB GSI on page metadata table (ModifiedDate-GSI)
- Query: Sort by modified timestamp, paginate 50 items
- Storage plugin maintains LastModified metadata
- Simple event: {pageId, title, author, action, timestamp}
- Cost: ~$0.25/million queries (on-demand pricing)
- Fallback: Storage plugin metadata if DynamoDB unavailable
- No separate activity log needed - use existing page metadata

---

### 4. Sitemap Data Retrieval
**Question**: How is the full sitemap hierarchy data retrieved?

**ANSWERED**: Lazy-load with CloudFront caching
- On-demand: API endpoint returns children for expanded folder only
- Root level: Single DynamoDB query for top-level pages (~10-50 items)
- Child load: Query by parent folder path on expand
- CloudFront cache: 5 minutes (configurable)
- Page metadata includes: {id, shortCode, title, parentPath, hasChildren}
- Performance: <200ms per level load, <2 seconds full tree (1000 pages)
- Refresh: Cache invalidation on page create/move/delete
- No full scan needed - hierarchical queries only

---

### 5. Activity Feed vs Page History Integration
**Question**: How does this spec relate to page history spec (#9)?

**ANSWERED**: Separate but complementary features
- **Recent Changes**: Lightweight overview across all pages (last 50-100)
- **Page History**: Detailed version history for single page
- Data source: Same page metadata, different views
- Recent changes: Query ModifiedDate-GSI across all pages
- Page history: Query VersionHistory attribute for specific page
- No duplication - page metadata stores both current + history
- Recent changes shows summary; history shows full diffs/versions

**Aligned with Spec #13 (Dashboard)**:
- Dashboard shows last 10 recent changes (no pagination)
- Recent Changes page (this spec) shows same data with pagination
- Both use same backend query - DRY principle
- Dashboard = quick overview, Recent Changes = full history browsing
- No personal/user-specific activity tracking (MVP decision)

---

### NEW: URL Structure Impact on Navigation
**Question**: How does the short-code URL structure affect navigation features?

**ANSWERED**: All navigation uses short-code GUID URLs

**Implementation**:
- Recent changes: Links use `/pages/{short-code}/Page Title`
- Sitemap: All links use short-code format
- Activity feed: User actions tracked by short-code
- URL mapping service maintains:
  - Short-code → S3 path mapping
  - Page title for URL display
  - Deletion status for broken link detection
- Navigation can cache mappings for performance
- Broken links detected by checking deletion status

---

## 🟡 High Priority - Important for User Experience

### 6. Breadcrumb Truncation Strategy
**Question**: How exactly do breadcrumbs truncate on narrow screens?

**ANSWERED**: CSS-based responsive truncation
- Desktop: CSS `text-overflow: ellipsis` at 40 characters per segment
- Desktop example: "Home > Projects > Very Long Project Na... > Current Page"
- Mobile (<768px): Show last 2 segments with dropdown menu
- Mobile example: "[≡] ... > Q4 > Planning"
- Dropdown: Native `<select>` or simple popover (click "≡" icon)
- Dropdown shows full breadcrumb trail (all segments)
- No JavaScript required for truncation - pure CSS
- Hover shows full text in tooltip (CSS `title` attribute)

---

### 7. TOC Scroll Highlighting
**Question**: How is the "current position" in TOC determined and highlighted?

**ANSWERED**: Intersection Observer API with top threshold
- Use Intersection Observer API (modern, performant)
- Threshold: Heading crosses top 20% of viewport (rootMargin: '-20% 0px -80% 0px')
- Highlight style: Blue left border (3px) + bold text + slight background tint
- Active class: `toc-item-active`
- Performance: Efficient even with 100+ headings (native browser optimization)
- Fallback: No highlighting if browser doesn't support (graceful degradation)
- Auto-scroll TOC to keep active item visible

---

### 8. Recent Changes Grouping Logic
**Question**: How does the optional grouping of sequential edits work?

**ANSWERED**: Simple same-page grouping, enabled by default
- Grouping: Same page + same author + within 1 hour window
- Enabled by default (user preference toggle in settings)
- Display: "3 edits" badge, click to expand inline
- Shows: Individual timestamps when expanded
- Across pages: Not grouped (too complex, less useful)
- Client-side logic: Process after fetching activity data
- Example: "John edited Planning (3 edits) - 2:30 PM" → expands to "2:30 PM, 2:15 PM, 1:45 PM"

---

### 9. Deleted Page Display in Activity Feed
**Question**: How long do deleted pages remain in activity feed?

**ANSWERED**: Natural aging with filter option
- Deleted pages remain in feed until aged out by pagination (natural)
- Shown with strike-through + "(deleted)" label + no link
- Filter toggle: "Hide deleted pages" (default: show)
- Keep metadata for 90 days, then archive/remove
- If restored: Automatically re-appears as normal link
- Deletion flag in metadata: `status: 'deleted', deletedAt: timestamp`
- Activity feed queries include deleted items, client filters if toggle enabled

---

### 10. Sitemap Lazy Loading Implementation
**Question**: How does lazy loading work for large sitemaps?

**ANSWERED**: One level at a time with caching
- Load: Direct children only (one level at a time)
- Cache: Store loaded children in memory, persist on re-expand
- Loading indicator: Spinner icon while fetching (~200ms)
- Threshold: Always use lazy loading (even small wikis - consistent UX)
- API call: `GET /api/sitemap/children?parentPath=/folder/subfolder`
- Returns: Array of {shortCode, title, hasChildren, order}
- Cache invalidation: Clear on page create/move/delete events
- Progressive disclosure: Prevents overwhelming UI with 1000+ pages

---

### 11. Activity Feed Performance
**Question**: What are the performance targets for loading recent changes?

**ANSWERED**: Sub-second load with pagination
- Target: <500ms initial load (p95)
- Items per page: 50 (configurable, range: 25-100)
- Pagination: Cursor-based using timestamp
- Archive: Keep 90 days active, archive older to cold storage (S3)
- DynamoDB query: Limit 50, reverse sort by timestamp
- CloudFront cache: 1 minute for recently active wikis
- Filtered views: Same performance (filtered server-side via query parameters)
- Degrade gracefully: Show cached data if query >2 seconds

---

### 12. Sitemap Tree Interaction
**Question**: What interactions are supported beyond expand/collapse?

**ANSWERED**: Simple navigation-focused interactions
- Primary: Click to navigate to page (opens in same/new tab)
- Expand/collapse: Click folder icon or arrow
- Context menu: Right-click for "Open in new tab", "Copy link"
- No drag-drop: Too complex for initial version (use move page feature)
- No multi-select: Out of scope for navigation feature
- No inline editing: Use dedicated page management features
- Keep it simple: Focus on browsing and discovery, not management
- Future enhancement: Drag-drop can be added later if needed

---

### 13. TOC Visibility Rules
**Question**: When exactly is TOC shown or hidden?

**ANSWERED**: Heading count threshold with user toggle
- Threshold: Show if page has ≥3 headings (H1-H4)
- Page length: Irrelevant, only heading count matters
- Manual toggle: User preference saved in localStorage
- Position: Sticky sidebar on desktop, scrolls with page
- Mobile: Floating button (bottom-right) opens modal overlay
- Default state: Auto (follows 3-heading rule) + respects user preference
- Setting: "Show TOC" - Auto / Always / Never
- Sticky behavior: Fixed position when scrolling past page header

---

### 14. Breadcrumb Home Link Behavior
**Question**: What does clicking "Home" in breadcrumbs do?

**ANSWERED**: Navigate to wiki homepage/dashboard
- Default: Navigate to wiki homepage (spec #13 - dashboard)
- Homepage shows: Welcome, recent changes, quick links
- Configurable: Admin can set homepage to specific page
- Setting: `homepage.shortCode` in wiki configuration
- Fallback: Root sitemap view if no homepage configured
- Consistent with user expectation: "Home" = starting point

---

### 15. Activity Feed Action Types
**Question**: What action types are tracked beyond created/edited/deleted?

**ANSWERED**: Core page actions only for simplicity
- Tracked: created, edited, deleted, moved, renamed
- Action metadata: {type, pageId, title, author, timestamp, oldValue}
- Moved: Shows "moved from [old path]"
- Renamed: Shows "renamed from [old title]"
- Not tracked (out of scope): permissions, attachments, comments
- Keep it simple: Focus on page content changes
- Extensible: Action type enum can expand in future
- Avoid noise: Only significant changes in feed

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. TOC Print Behavior
**Question**: Should TOC be included when printing pages?

**ANSWERED**: Hide TOC in print view
- Print stylesheet: `@media print { .toc { display: none; } }`
- Rationale: Page content is primary, TOC is navigation aid
- Print-friendly: Full width for content without sidebar
- Optional: User can toggle "Include TOC in print" (advanced)
- Default: Hide TOC, show only page content + breadcrumbs
- Simple and clean printed output

---

### 17. Breadcrumb SEO Markup
**Question**: Should breadcrumbs include structured data for SEO?

**ANSWERED**: Skip SEO markup (not needed)
- Family wiki: Likely private/authenticated access
- No public search indexing required
- Skip JSON-LD structured data (unnecessary complexity)
- Keep HTML semantic: Use `<nav>` and `<ol>` for breadcrumbs
- Future: Add if wiki becomes public-facing
- Cost savings: Simpler implementation, no SEO maintenance

---

### 18. Recent Changes RSS Feed
**Question**: Should recent changes be available as RSS/Atom feed?

**ANSWERED**: Skip RSS feed (future enhancement)
- V1: No RSS/Atom feed (YAGNI - You Aren't Gonna Need It)
- Rationale: Users can check activity feed in-app
- Email notifications: Separate feature if needed (future)
- Alternative: Simple API endpoint for external integrations
- Cost savings: Avoid RSS generation and caching complexity
- Future: Add if users request external monitoring tools

---

### 19. TOC Deeplink Sharing
**Question**: Can users share links to specific sections (anchors)?

**ANSWERED**: Yes, anchor links supported
- TOC links: Update URL with anchor fragment (#section-name)
- Format: `/pages/{shortCode}/Page Title#section-name`
- Copy link: Right-click TOC item → "Copy link to section"
- Share: Paste URL, recipient scrolls to section automatically
- Browser behavior: Smooth scroll to anchor on load
- Simple implementation: Standard HTML anchor behavior
- Very useful for long reference pages

---

### 20. Sitemap Search/Filter
**Question**: Should sitemap have search/filter capability?

**ANSWERED**: Simple text search only
- Search: Text input at top of sitemap (filter by page title)
- Client-side: Filter visible pages as user types (instant)
- Matching: Case-insensitive substring match on page titles
- Display: Show matching pages + their parent chain (context)
- No advanced filters: Skip author/date/tags (too complex)
- Alternative: Use global search feature for advanced queries
- Keep sitemap simple: Browse hierarchy, quick text filter

---

### 21. Activity Feed Subscription
**Question**: Can users subscribe to specific folders/pages for notifications?

**ANSWERED**: Not in V1 (separate notifications feature)
- V1: Show all recent changes (no personalization)
- Filter: User can manually filter by folder/author
- Notifications: Separate feature spec (future enhancement)
- Rationale: Simpler implementation, family wiki = small team
- Alternative: Filter dropdown ("Show only: Folder X")
- Future: Add "watch" feature if wiki grows large
- Keep V1 simple and low-cost

---

### 22. Breadcrumb Microinteractions
**Question**: Should breadcrumbs have hover/interaction effects?

**ANSWERED**: Simple hover state only
- Hover: Underline + color change (blue → darker blue)
- Tooltip: Show full segment text if truncated (CSS `title`)
- No preview: Avoid complexity, keep breadcrumbs fast
- Cursor: Pointer on links, default on current page
- Focus: Keyboard accessible with visible focus ring
- Keep it simple: Standard link interaction patterns
- Performance: No JavaScript or API calls on hover

---

### 23. TOC Keyboard Navigation
**Question**: Should TOC support keyboard navigation?

**ANSWERED**: Yes, full keyboard accessibility
- Tab: Focus TOC items (standard link behavior)
- Arrow keys: Navigate through TOC items (optional enhancement)
- Enter/Space: Jump to section
- Escape: Close mobile TOC overlay
- Skip link: "Skip to main content" bypasses TOC
- ARIA labels: `aria-label="Table of Contents"`
- Focus visible: Clear focus ring for keyboard users
- Accessibility: WCAG 2.1 AA compliance required

---

### 24. Recent Changes Export
**Question**: Can activity feed be exported?

**ANSWERED**: Not in V1 (future enhancement)
- V1: No export functionality
- Rationale: Rare use case, adds complexity
- Alternative: Users can copy/paste visible feed
- Future: Add "Export to CSV" if requested
- Format would be: Date, Time, Page, Author, Action
- Cost savings: Skip export feature, simple UI
- YAGNI: Implement only when needed

---

### 25. Sitemap Print/Export
**Question**: Can sitemap be printed or exported?

**ANSWERED**: Simple print support only
- Print: CSS print stylesheet for sitemap
- Format: Indented outline (expand all folders)
- Export: Not in V1 (future enhancement)
- Print includes: Page titles and hierarchy
- Print excludes: Interactive elements (expand buttons)
- Alternative: Use browser print to PDF
- Keep it simple: Standard print functionality
- Future: Add export formats if requested

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially data source decisions for activity feed and sitemap
2. **Clarify relationship with page history spec** - avoid duplication
3. **Define performance requirements** - especially for large wikis (1000+ pages)
4. **Create mockups** - especially for mobile breadcrumb collapse and TOC mobile overlay

Would you like me to:
- Help design the activity feed data model?
- Create UI mockups for breadcrumbs, TOC, and sitemap?
- Research TOC generation libraries and approaches?
