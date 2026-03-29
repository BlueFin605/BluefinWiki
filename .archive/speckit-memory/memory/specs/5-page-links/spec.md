# Feature Specification: Page Links (Internal Wiki and External URLs)

**Feature Branch**: `5-page-links`
**Created**: 2026-01-12
**Updated**: 2026-03-16
**Status**: Implemented
**Input**: User description: "Add a link to other resources in a page - link to another wiki page, link to external url. When a link is added to and identity the description so it shows rather than the raw url. But also allow the ability to edit the url and description"

> **Implementation Note (2026-03-16)**: Wiki-style `[[Page Title]]` links are supported via the `remarkWikiLinks` plugin. Broken link detection is implemented with visual indicators and a "Create Page" option when clicking broken links. Backlinks are displayed in the Inspector Panel's Links tab (via `LinkedPagesPanel`). The "Copy Link" feature (FR-022, P3) has not yet been implemented.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Insert Link to Another Wiki Page (Priority: P1)

A user inserts a link to another page within the wiki using the editor toolbar, which opens a page picker showing the wiki hierarchy for easy selection and inserts markdown with a readable description.

**Why this priority**: Internal page linking is fundamental to wiki navigation and content interconnection. Without this, the wiki cannot function as a connected knowledge base.

**Independent Test**: Create two pages "Home" and "Getting Started", edit "Home", click "Insert Link" toolbar button, search for "Getting Started", select it, and verify markdown `[Getting Started](/wiki/getting-started)` is inserted and renders correctly.

**Acceptance Scenarios**:

1. **Given** a user is editing a page, **When** they click "Insert Link" toolbar button, **Then** a link insertion dialog opens with tabs for "Wiki Page" and "External URL"
2. **Given** the "Wiki Page" tab is active, **When** displayed, **Then** a searchable tree view shows the wiki page hierarchy
3. **Given** the page picker, **When** a user types in the search box, **Then** pages are filtered by title in real-time
4. **Given** a user selects a page "Getting Started", **When** they click "Insert", **Then** markdown `[Getting Started](/wiki/path/to/getting-started)` is inserted at cursor
5. **Given** selected text exists, **When** a user inserts a wiki page link, **Then** the selected text becomes the link description instead of the page title

---

### User Story 2 - Insert External URL with Custom Description (Priority: P1)

A user inserts a link to an external website with a custom description text, which creates markdown syntax showing the description instead of the raw URL.

**Why this priority**: External links are essential for referencing documentation, tools, and resources. Readable descriptions improve content quality and user experience.

**Independent Test**: Edit a page, click "Insert Link", select "External URL" tab, enter URL "https://example.com" and description "Example Website", verify markdown `[Example Website](https://example.com)` is inserted and renders as clickable link.

**Acceptance Scenarios**:

1. **Given** the link insertion dialog, **When** "External URL" tab is selected, **Then** form fields for "URL" and "Description" are shown
2. **Given** the URL field, **When** a user enters "https://example.com", **Then** the description field auto-suggests using the URL domain "example.com" as default
3. **Given** URL and description are entered, **When** user clicks "Insert", **Then** markdown `[Description](URL)` is inserted at cursor position
4. **Given** selected text exists, **When** inserting external link, **Then** the selected text pre-fills the description field
5. **Given** an invalid URL format, **When** user tries to insert, **Then** validation error shows "Please enter a valid URL starting with http:// or https://"

---

### User Story 3 - Edit Existing Link URL and Description (Priority: P1)

A user clicks on an existing link in the editor, which opens the link dialog pre-filled with current URL and description, allowing them to modify either or both values.

**Why this priority**: Link maintenance is essential for keeping wiki content accurate. URLs change, and descriptions need refinement.

**Independent Test**: Create a link `[Old Text](old-url)`, place cursor within the link, click "Edit Link" or use keyboard shortcut, modify description to "New Text" and URL to "new-url", save, and verify markdown updates correctly.

**Acceptance Scenarios**:

1. **Given** cursor is positioned within a markdown link, **When** user clicks "Edit Link" toolbar button (or uses Ctrl+K), **Then** the link dialog opens with current URL and description pre-filled
2. **Given** the edit link dialog, **When** user modifies the description field, **Then** the markdown link text updates on save
3. **Given** the edit link dialog, **When** user modifies the URL field, **Then** the markdown link target updates on save
4. **Given** an internal wiki link, **When** edited, **Then** the dialog shows "Wiki Page" tab active with current page selected in picker
5. **Given** an external link, **When** edited, **Then** the dialog shows "External URL" tab active with current URL and description

---

### User Story 4 - Auto-Detect and Convert Raw URLs to Links (Priority: P2)

When a user pastes or types a raw URL (e.g., `https://example.com`), the editor automatically detects it and offers to convert it to a markdown link with editable description.

**Why this priority**: Convenience feature that improves user experience but not essential. Users can manually use the link toolbar.

**Independent Test**: Type or paste "https://github.com" in the editor, verify the editor shows an inline suggestion or prompt to "Convert to link", accept it, and confirm markdown `[github.com](https://github.com)` is created.

**Acceptance Scenarios**:

1. **Given** a user types or pastes a URL pattern (http:// or https://), **When** the URL is complete (ends with space or newline), **Then** an inline suggestion appears "Convert to link?"
2. **Given** the conversion suggestion, **When** user clicks "Yes" or presses Tab, **Then** a quick-edit dialog appears with URL pre-filled and description suggested
3. **Given** the quick-edit dialog, **When** user accepts default or modifies description, **Then** raw URL is replaced with markdown link syntax
4. **Given** the conversion suggestion, **When** user ignores it or clicks "No", **Then** the raw URL remains as plain text
5. **Given** multiple URLs in a paste, **When** content is pasted, **Then** all URLs are detected with batch conversion option "Convert all X URLs to links"

---

### User Story 5 - Preview Link Hover Tooltip (Priority: P2)

When a user hovers over a link in the preview pane or published page, a tooltip shows the link destination, helping verify the link target without clicking.

**Why this priority**: Useful for quality control and link verification but not essential for basic linking functionality.

**Independent Test**: Create a link to another page, view in preview pane, hover over the link, and verify a tooltip displays showing the full target path or URL.

**Acceptance Scenarios**:

1. **Given** a link in the preview pane, **When** user hovers cursor over it, **Then** a tooltip appears showing the link target URL or page path
2. **Given** an internal wiki link, **When** tooltip is shown, **Then** it displays the full wiki path (e.g., "/wiki/projects/getting-started")
3. **Given** an external link, **When** tooltip is shown, **Then** it displays the full URL (e.g., "https://example.com/page")
4. **Given** a link with the same description as URL, **When** tooltip is shown, **Then** it still displays to confirm the exact target
5. **Given** the tooltip, **When** displayed, **Then** it appears within 500ms and disappears when cursor moves away

---

### User Story 6 - Link Validation and Broken Link Detection (Priority: P3)

The system validates internal wiki links to ensure target pages exist and warns users about broken links, optionally checking external URLs for accessibility.

**Why this priority**: Nice to have for content quality but not essential for MVP. Users can manually verify links work.

**Independent Test**: Create a link to a non-existent page "/wiki/does-not-exist", save the page, and verify the editor or page view shows a warning indicator "Broken link: target page not found".

**Acceptance Scenarios**:

1. **Given** an internal wiki link is inserted, **When** the page is saved, **Then** the system validates the target page exists
2. **Given** a broken internal link (target page doesn't exist), **When** detected, **Then** the link is styled differently (e.g., red underline) with tooltip "Broken link"
3. **Given** a broken link indicator, **When** clicked, **Then** user is offered options to "Create target page" or "Edit link"
4. **Given** external URLs, **When** link validation is enabled, **Then** system optionally checks if URLs are accessible (HTTP HEAD request)
5. **Given** multiple broken links on a page, **When** page is edited, **Then** a summary notification shows "X broken links found" with list

---

### User Story 7 - Insert Link from Page Title Search (Priority: P1)

A user types `[[` in the editor to trigger quick link insertion, then types a few characters to search for pages by title, selects from suggestions, and the wiki link is automatically inserted.

**Why this priority**: Quick wiki-style linking is a productivity feature that makes internal linking fast and intuitive. Essential for good wiki experience.

**Independent Test**: In editor, type `[[start` and verify a dropdown shows pages matching "start" (e.g., "Getting Started"), select one, and confirm `[[Getting Started]]` or `[Getting Started](/wiki/path)` is inserted.

**Acceptance Scenarios**:

1. **Given** a user types `[[` in the editor, **When** the second bracket is entered, **Then** an autocomplete dropdown appears showing recent pages
2. **Given** the autocomplete is active, **When** user continues typing, **Then** the dropdown filters pages by title in real-time
3. **Given** matching pages are shown, **When** user clicks a page or presses Enter, **Then** a wiki link is inserted using page title and path
4. **Given** the inserted link, **When** using wiki-style syntax, **Then** it's either `[[Page Title]]` or converted to standard markdown `[Page Title](/path)`
5. **Given** no matches found, **When** user finishes typing and presses Enter, **Then** option appears to "Create new page with this title"

---

### User Story 8 - Copy Link to Current Page (Priority: P3)

A user viewing a page can copy a shareable link to the current page with one click, which includes the full URL or wiki path format.

**Why this priority**: Convenience feature for sharing pages but not essential for MVP. Users can copy from address bar.

**Independent Test**: View a page, click "Copy Link" button in page header, verify the wiki path or full URL is copied to clipboard, and user sees confirmation "Link copied".

**Acceptance Scenarios**:

1. **Given** a user is viewing a page, **When** they click "Copy Link" button, **Then** the page's full URL or wiki path is copied to clipboard
2. **Given** link is copied, **When** copy succeeds, **Then** a brief toast notification shows "Link copied to clipboard"
3. **Given** copy link options, **When** user clicks dropdown, **Then** options include "Copy as wiki link" `[[Title]]`, "Copy as markdown" `[Title](url)`, or "Copy full URL"
4. **Given** the clipboard content, **When** pasted into editor, **Then** it's ready to use as a link
5. **Given** clipboard API fails, **When** copy is attempted, **Then** a fallback shows the link in a text box for manual copy

---

### User Story 9 - Backlinks - See Which Pages Link Here (Priority: P3)

A user viewing a page can see a list of other pages that link to the current page, helping understand page interconnections and navigation paths.

**Why this priority**: Useful for navigation and understanding relationships but not essential for MVP. Can be added later as a feature enhancement.

**Independent Test**: Create page A, page B, and page C, add links from B and C to page A, view page A, and verify a "Backlinks" section shows "Linked from: Page B, Page C".

**Acceptance Scenarios**:

1. **Given** a page is viewed, **When** other pages link to it, **Then** a "Backlinks" or "Linked from" section appears at the bottom
2. **Given** the backlinks section, **When** displayed, **Then** it shows page titles as clickable links
3. **Given** backlinks list, **When** clicked, **Then** user navigates to the linking page
4. **Given** no pages link to current page, **When** backlinks section is checked, **Then** it shows "No pages link to this page yet"
5. **Given** backlinks are computed, **When** a linking page is deleted or link is removed, **Then** backlinks list updates accordingly

---

### Edge Cases

- What happens when a user inserts a link with special characters in the description (e.g., brackets, parentheses)? Characters are escaped or encoded in markdown to prevent syntax breaking.
- What happens when a wiki link target page is renamed? System updates all references if GUID-based linking is used, or marks as broken if path-based.
- What happens when external URL is unreachable or invalid? Link still inserts but validation warning shown; link works but user is warned.
- What happens when user pastes markdown content containing links? Existing markdown links are preserved and correctly parsed; no double-conversion.
- What happens when link description is empty? System inserts the URL itself as description (e.g., `[https://example.com](https://example.com)`).
- What happens when user types `[[page title]]` but page doesn't exist? System creates broken link indicator and offers "Create this page" option.
- What happens when multiple pages have the same title? Search results show full path to disambiguate; user selects correct page from list.
- What happens when user creates circular references (Page A links to B, B links to C, C links to A)? This is allowed; no validation against circular references needed.
- What happens when pasting URL from clipboard that has tracking parameters? URL is inserted as-is; optional future feature to clean tracking params.
- What happens when link is to an anchor within a page (e.g., #section)? Both internal page anchors and external URL anchors are supported with # fragment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide toolbar button "Insert Link" in the page editor
- **FR-002**: Link insertion dialog MUST have tabs for "Wiki Page" and "External URL"
- **FR-003**: Wiki Page tab MUST display searchable tree view of all wiki pages organized by hierarchy
- **FR-004**: Page picker search MUST filter pages by title with real-time results
- **FR-005**: System MUST insert markdown link syntax `[Description](URL)` when link is added
- **FR-006**: System MUST support selecting existing text before inserting link, using selected text as description
- **FR-007**: External URL tab MUST provide fields for "URL" and "Description" with validation
- **FR-008**: System MUST validate external URLs start with `http://` or `https://` protocols
- **FR-009**: System MUST auto-suggest description based on URL domain when URL is entered
- **FR-010**: System MUST support editing existing links by opening link dialog with pre-filled values
- **FR-011**: System MUST detect cursor position within markdown link syntax for edit operation
- **FR-012**: System MUST support keyboard shortcut (Ctrl+K or Cmd+K) for insert/edit link
- **FR-013**: System MUST auto-detect raw URLs (http:// or https://) in editor content
- **FR-014**: System MUST offer inline suggestion to convert raw URLs to markdown links
- **FR-015**: System MUST display link destination tooltip on hover in preview and published pages
- **FR-016**: Tooltips MUST show full URL or wiki path within 500ms of hover
- **FR-017**: System MUST support wiki-style quick link syntax `[[Page Title]]` triggering autocomplete
- **FR-018**: Autocomplete MUST show page suggestions filtered by typed characters
- **FR-019**: System MUST convert internal page links to use page paths or GUIDs for stability
- **FR-020**: System MUST validate internal wiki links and detect broken links (target page not found)
- **FR-021**: Broken links MUST be visually indicated with different styling (e.g., red underline)
- **FR-022**: System MUST provide "Copy Link" functionality from page view with clipboard API
- **FR-023**: System MUST support multiple link formats: wiki syntax, markdown, full URL
- **FR-024**: System MUST track backlinks (which pages link to current page) for navigation (P3)
- **FR-025**: System MUST sanitize link URLs to prevent XSS attacks (no javascript: protocol)

### Key Entities

- **Link**: Represents a hyperlink in page content
  - Attributes: linkType (internal/external), description (display text), targetURL (for external) or targetPageId (for internal), sourcePageId, createdAt
  - Storage: Inline in markdown content as `[description](url)` syntax
  - Relationships: Belongs to one source page, optionally references one target page

- **PageReference**: Tracks which pages link to which other pages (for backlinks)
  - Attributes: sourcePageId (GUID), targetPageId (GUID), linkDescription, createdAt
  - Storage: DynamoDB table or computed on-demand from page content
  - Relationships: Many-to-many between pages (one page can link to many, many can link to one)

- **LinkValidation**: Result of validating a link's target accessibility
  - Attributes: linkURL or pageId, isValid (boolean), lastChecked (timestamp), errorMessage
  - Storage: Cached in DynamoDB with TTL for external URLs
  - Relationships: One validation per unique link

- **LinkAutosuggestion**: Represents a suggested page in autocomplete dropdown
  - Attributes: pageId, pageTitle, pagePath, relevanceScore, lastModified
  - Storage: Computed dynamically from page index
  - Relationships: Represents available target pages for linking

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Link insertion dialog opens within 500ms of clicking toolbar button
- **SC-002**: Page picker search filters results within 200ms of each keystroke
- **SC-003**: Wiki page search returns relevant results for 95% of partial title queries
- **SC-004**: Inserted markdown link syntax is syntactically correct 100% of the time
- **SC-005**: Link editing pre-fills current values correctly 100% of the time
- **SC-006**: URL validation prevents invalid protocols (e.g., javascript:) 100% of the time
- **SC-007**: Auto-detect identifies raw URLs with 95% accuracy (avoiding false positives in code blocks)
- **SC-008**: Tooltip displays link destination within 500ms of hover
- **SC-009**: Wiki-style `[[` autocomplete triggers within 100ms and shows suggestions in 200ms
- **SC-010**: Autocomplete dropdown filters pages by title with 95% relevance matching
- **SC-011**: Internal wiki links resolve correctly to target pages 100% of the time
- **SC-012**: Broken link detection identifies non-existent pages with 100% accuracy
- **SC-013**: Copy link to clipboard succeeds on 95% of modern browsers (with fallback for others)
- **SC-014**: Backlinks list updates within 1 second when page content changes (P3 feature)
- **SC-015**: Link insertion and editing supports both keyboard and mouse workflows with equal functionality

## Assumptions

- Markdown link syntax `[description](url)` is the standard format for all links
- Internal wiki links use paths (e.g., `/wiki/page-slug`) or GUIDs for stability
- GUID-based page storage from S3 plugin enables stable links through renames
- Page picker can efficiently load and filter wiki hierarchy (up to 10,000 pages)
- Browser clipboard API is available for copy link functionality (with fallback)
- Users understand basic markdown link syntax or learn through toolbar
- External URL validation is basic (protocol check); deep validation (HTTP HEAD) is optional/P3
- Backlinks are computed from page content analysis or maintained in separate index
- Auto-detect URL pattern matching doesn't need to be 100% perfect (users can undo/ignore)
- Wiki-style `[[Page Title]]` syntax is familiar to users from other wikis (Wikipedia, Notion)
- Link tooltips don't need to show page preview (just URL/path)
- Circular link references between pages are allowed and not problematic
- Link description can contain most characters; edge cases are escaped in markdown
- Copy link functionality works best in HTTPS context for clipboard API security

## Out of Scope

The following are explicitly **not** included in this specification:

- Rich link previews with page thumbnails or excerpts (future enhancement)
- Deep link validation checking if external URLs return 200 status (optional P3)
- Link shortening or URL beautification (future enhancement)
- Link analytics or tracking click-through rates (separate analytics feature)
- Automatic link rot detection and notification (future maintenance feature)
- Link suggestions based on page content similarity (AI/ML future enhancement)
- Email address auto-detection and mailto: links (future enhancement)
- Phone number detection and tel: links (future enhancement)
- File download links with special handling (covered by attachments feature)
- Link annotations or comments (future collaboration feature)
- Link categories or tagging (future organization feature)
- Bidirectional link graph visualization (future enhancement)
- Link preview before clicking (future UX enhancement)
- Historical link tracking (which links existed before/after edits) (future audit feature)
- Batch link updates when page structure changes (future automation)

## Constitutional Compliance

This feature aligns with the BlueFinWiki Constitution:

- **Content-First Architecture (Principle II)**: Links serve content discovery and navigation
- **Markdown File Format (Non-Negotiable #5)**: Uses standard markdown link syntax `[text](url)`
- **Hierarchical Page Structure (Non-Negotiable #4)**: Page picker shows hierarchy for easy link navigation
- **Family-Friendly Experience (Principle IV)**: Toolbar and dialogs make linking accessible to all skill levels
- **Simplicity (Principle III)**: Straightforward link insertion without complex features
- **Storage Plugin Integration**: Links stored as markdown in content, paths resolved via storage plugin
- **GUID-Based Stability**: Internal links using GUIDs (from S3 plugin) survive page renames

## Technical Notes

### Link Insertion Dialog

```
┌─────────────────────────────────────┐
│  Insert Link                    [X] │
├─────────────────────────────────────┤
│  [Wiki Page] [External URL]         │
├─────────────────────────────────────┤
│  Search pages:                      │
│  [________________]                 │
│                                     │
│  📁 Projects                        │
│    📄 Getting Started               │
│    📄 Project Alpha                 │
│  📁 Documentation                   │
│    📄 API Reference                 │
│                                     │
│              [Cancel] [Insert]      │
└─────────────────────────────────────┘
```

### External URL Dialog

```
┌─────────────────────────────────────┐
│  Insert Link                    [X] │
├─────────────────────────────────────┤
│  [Wiki Page] [External URL]         │
├─────────────────────────────────────┤
│  URL:                               │
│  [https://example.com_________]     │
│                                     │
│  Description:                       │
│  [Example Website_____________]     │
│                                     │
│              [Cancel] [Insert]      │
└─────────────────────────────────────┘
```

### Markdown Link Formats

```markdown
<!-- External URL -->
[Example Website](https://example.com)

<!-- Internal wiki link (path-based) -->
[Getting Started](/wiki/getting-started)

<!-- Internal wiki link (GUID-based for stability) -->
[Getting Started](page:abc123-def456)

<!-- Wiki-style syntax (optional, converted to markdown) -->
[[Getting Started]]

<!-- Link with title attribute (for tooltip) -->
[Example](https://example.com "Visit Example Website")
```

### Auto-Detect URL Pattern

```typescript
// Detect URLs in text
const urlPattern = /https?:\/\/[^\s]+/g;
const matches = content.match(urlPattern);

// Offer conversion
if (matches) {
  showInlineSuggestion('Convert to link?', () => {
    const url = matches[0];
    const description = extractDomain(url); // e.g., "example.com"
    replaceWith(`[${description}](${url})`);
  });
}
```

### Wiki-Style Quick Link

```typescript
// Detect [[ trigger
editor.on('input', (event) => {
  const text = getTextBeforeCursor(2);
  if (text === '[[') {
    showAutocomplete(searchPages);
  }
});

// On page selection
function insertWikiLink(page) {
  const markdown = `[${page.title}](${page.path})`;
  replaceRange('[[', markdown);
}
```

### Backlinks Computation

```typescript
// Extract all links from page content
function extractLinks(markdown) {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;
  while ((match = linkPattern.exec(markdown)) !== null) {
    links.push({ description: match[1], url: match[2] });
  }
  return links;
}

// Find pages linking to current page
function getBacklinks(pageId) {
  // Query all pages, extract links, filter for current pageId
  // Or maintain index in DynamoDB for performance
}
```
