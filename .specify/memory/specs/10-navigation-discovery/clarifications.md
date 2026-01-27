# Clarification Questions: Page Navigation & Discovery

**Feature**: Page Navigation & Discovery  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Breadcrumb Path Generation
**Question**: How are breadcrumbs generated from the page hierarchy?

**Current spec shows**: "Home > Projects > 2024 > Q4 > Planning"

**Needs clarification**:
- Are breadcrumbs based on folder structure in storage (S3 paths)?
- Or based on parent references in page frontmatter?
- If page is moved, do breadcrumbs update automatically?
- What if parent page is deleted - does breadcrumb break?
- Should breadcrumb generation use cached metadata (DynamoDB) or query storage on each page load?

---

### 2. Table of Contents Heading Extraction
**Question**: How are headings extracted from markdown for TOC generation?

**Needs clarification**:
- Is TOC generated server-side or client-side (JavaScript)?
- If server-side, what markdown parser is used?
- If client-side, performance impact for large pages?
- How are heading IDs/anchors generated ("section-1" vs "section-heading-text")?
- What if two headings have identical text - how to make anchors unique?

---

### 3. Recent Changes Data Source
**Question**: Where does recent changes activity data come from?

**Current spec mentions**: "Queries the storage plugin's page history/metadata or maintains a separate activity log in DynamoDB"

**Needs decision**:
- Option A: Query storage plugin for all page metadata sorted by modified date (potentially slow for large wikis)
- Option B: Maintain separate DynamoDB ActivityLog table with events (more performant but adds complexity)
- Option C: Use CloudWatch logs or similar
- Which approach? What are the trade-offs?

---

### 4. Sitemap Data Retrieval
**Question**: How is the full sitemap hierarchy data retrieved?

**Current spec says**: "Retrieves hierarchy data from DynamoDB page metadata or queries the storage plugin's list operations"

**Needs clarification**:
- Is this a full scan of all pages (expensive)?
- Or cached/indexed hierarchy structure?
- How frequently is sitemap refreshed?
- Performance expectations for 1000+ page wiki?
- Should sitemap be generated on-demand or pre-built?

---

### 5. Activity Feed vs Page History Integration
**Question**: How does this spec relate to page history spec (#9)?

**Why this matters**: Both specs deal with change tracking and history.

**Needs clarification**:
- Is "recent changes" a different view of page history data?
- Or separate data source?
- Should they share the same backend events/tables?
- Can we consolidate to avoid duplication?

---

## 🟡 High Priority - Important for User Experience

### 6. Breadcrumb Truncation Strategy
**Question**: How exactly do breadcrumbs truncate on narrow screens?

**Current spec says**: "Names are truncated with ellipsis if exceeding 30 characters" and "On mobile, collapse to show only the last 2 segments with a '...' menu"

**Needs clarification**:
- Is 30 characters the right threshold (feels short)?
- Desktop truncation: "Projects > Very Long Proj... > Page" ?
- Mobile collapse: Shows "... > Q4 > Planning" with menu for earlier segments?
- How does the "..." menu work - dropdown or modal?

---

### 7. TOC Scroll Highlighting
**Question**: How is the "current position" in TOC determined and highlighted?

**Current spec says**: "The corresponding TOC entry is highlighted to show current position"

**Needs clarification**:
- Using Intersection Observer API for scroll tracking?
- What threshold - when heading is at top of viewport, or when in middle?
- How is highlight styled (background color, bold, indicator line)?
- Performance consideration for pages with 50+ headings?

---

### 8. Recent Changes Grouping Logic
**Question**: How does the optional grouping of sequential edits work?

**Current spec says**: "Optionally group sequential edits by the same author within 1 hour with '3 edits' label"

**Needs clarification**:
- Is grouping enabled by default or user preference?
- Can user expand grouped edits to see individual timestamps?
- Does grouping apply across different pages by same author?
- Or only same page, same author, within time window?

---

### 9. Deleted Page Display in Activity Feed
**Question**: How long do deleted pages remain in activity feed?

**Current spec says**: "Page title is displayed but not linked, with strike-through styling and '(deleted)' label"

**Needs clarification**:
- Do deleted pages eventually age out of activity feed?
- Or remain permanently (until pushed off by pagination)?
- Should there be filter to "hide deleted pages"?
- What if deleted page is later restored (page history feature)?

---

### 10. Sitemap Lazy Loading Implementation
**Question**: How does lazy loading work for large sitemaps?

**Current spec says**: "Initially shows root level only with lazy loading of children on expand"

**Needs clarification**:
- Are children loaded one level at a time or all descendants at once?
- Cache loaded children or reload on next expand?
- Loading indicator during fetch?
- What's the threshold for "large wiki" requiring lazy loading (100 pages? 500?)?

---

### 11. Activity Feed Performance
**Question**: What are the performance targets for loading recent changes?

**Needs clarification**:
- Maximum load time: 500ms? 1 second? 2 seconds?
- How many items to fetch per query (50 mentioned in spec)?
- Should older items be archived to optimize queries?
- Different performance expectations for filtered vs unfiltered views?

---

### 12. Sitemap Tree Interaction
**Question**: What interactions are supported beyond expand/collapse?

**Needs clarification**:
- Right-click context menu (rename, delete, move)?
- Drag and drop to reorganize?
- Select multiple pages for bulk operations?
- Or purely navigation (click to open page)?

---

### 13. TOC Visibility Rules
**Question**: When exactly is TOC shown or hidden?

**Current spec says**: "If page has fewer than 3 headings, TOC is not displayed"

**Needs clarification**:
- Is 3 headings the right threshold?
- Does page length matter (e.g., short page with 5 headings still shows TOC)?
- Can user manually toggle TOC visibility?
- Should TOC be sticky (follow scroll) or fixed position?

---

### 14. Breadcrumb Home Link Behavior
**Question**: What does clicking "Home" in breadcrumbs do?

**Needs clarification**:
- Navigate to dashboard (spec #13)?
- Navigate to sitemap/all pages?
- Navigate to root folder view?
- Configurable behavior?

---

### 15. Activity Feed Action Types
**Question**: What action types are tracked beyond created/edited/deleted?

**Needs clarification**:
- Page renamed?
- Page moved?
- Permissions changed?
- Attachment uploaded?
- Comment added (if comment feature exists)?
- How granular should activity tracking be?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. TOC Print Behavior
**Question**: Should TOC be included when printing pages?

**Not explicitly covered in spec**:
- Show TOC in print view?
- Or hide it (print only page content)?
- Separate print stylesheet?

---

### 17. Breadcrumb SEO Markup
**Question**: Should breadcrumbs include structured data for SEO?

**Not explicitly covered in spec**:
- JSON-LD breadcrumb schema?
- Relevant for family wiki (likely private)?
- Or not needed?

---

### 18. Recent Changes RSS Feed
**Question**: Should recent changes be available as RSS/Atom feed?

**Not explicitly covered in spec**:
- Useful for subscribing to wiki updates?
- Email notifications based on activity feed?
- Or overkill for family wiki?

---

### 19. TOC Deeplink Sharing
**Question**: Can users share links to specific sections (anchors)?

**Not explicitly covered in spec**:
- Copy link to section from TOC?
- URL updates with anchor when clicking TOC (#section)?
- Useful for referencing specific parts of long pages?

---

### 20. Sitemap Search/Filter
**Question**: Should sitemap have search/filter capability?

**Not explicitly covered in spec**:
- Search within sitemap to find page quickly?
- Filter by author, date, tags?
- Highlight matching pages in tree?

---

### 21. Activity Feed Subscription
**Question**: Can users subscribe to specific folders/pages for notifications?

**Not explicitly covered in spec**:
- "Watch" a folder to see its changes in personalized feed?
- Email notifications for watched content?
- Part of this spec or separate notifications feature?

---

### 22. Breadcrumb Microinteractions
**Question**: Should breadcrumbs have hover/interaction effects?

**Not explicitly covered in spec**:
- Hover shows full folder path tooltip?
- Hover shows folder contents preview?
- Just simple underline on hover?

---

### 23. TOC Keyboard Navigation
**Question**: Should TOC support keyboard navigation?

**Not explicitly covered in spec**:
- Tab to focus TOC items?
- Arrow keys to navigate?
- Enter to jump to section?
- Accessibility consideration?

---

### 24. Recent Changes Export
**Question**: Can activity feed be exported?

**Not explicitly covered in spec**:
- Export as CSV for record-keeping?
- Generate activity report?
- Useful for family history/documentation?

---

### 25. Sitemap Print/Export
**Question**: Can sitemap be printed or exported?

**Not explicitly covered in spec**:
- Print wiki structure as outline?
- Export as indented text or mind map?
- Useful for planning/documentation?

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
