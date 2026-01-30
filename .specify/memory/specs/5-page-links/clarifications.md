# Clarification Questions: Page Links

**Feature**: Page Links (Internal Wiki and External URLs)  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Wiki Link Syntax Choice
**Question**: What wiki link syntax should be used?

**Current spec shows two options**: `[[Page Title]]` and `[Page Title](/wiki/path)`

**Needs clarification**:
- Should system support BOTH syntaxes?
- Or choose ONE as the standard?
- If `[[Page Title]]` is used, how is it converted to markdown for storage?
- Is `[[` trigger for autocomplete only, or actual stored syntax?
- What happens if markdown renderer doesn't support `[[` syntax?

---

### 2. Link Resolution Strategy
**Question**: How are wiki page links resolved to actual pages?

**ANSWERED**: URLs use short-code GUID format: `/pages/{short-code-guid}/Page Title`

**Implementation**:
- Links stored as: `[Getting Started](/pages/abc-123/Getting Started)`
- Short-code GUID (e.g., `abc-123`) is stable and never changes
- Page title in URL is for SEO/readability but not used for routing
- System resolves short-code to actual S3 path via pluggable URL mapping service
- When page is renamed, URL still works (short-code unchanged)
- Page title in URL can be updated but is optional for link functionality

---

### 3. Link Storage Format
**Question**: What is the exact format of stored links in markdown?

**ANSWERED**: Format for each link type:
- Internal wiki page: `[Display](/pages/{short-code}/Page Title)`
- External URL: `[Display](https://...)`
- Attachment: `![Display](attachment-filename.ext)` (relative to page)
- Email: `[Email](mailto:...)`

**Decision**: Internal links use short-code GUID format:
- Format: `[Page Title](/pages/abc-123/Page Title)`
- Short-code `abc-123` is stable identifier
- Page title in URL is optional/cosmetic
- URL mapping service resolves short-code to S3 path

---

### 4. Broken Link Detection Performance
**Question**: How frequently are broken links checked?

**Current spec mentions**: "System validates the target page exists"

**Needs clarification**:
- Real-time validation on save?
- Background job checking all pages periodically?
- Only when explicitly requested by user?
- What if wiki has 10,000 pages - performance impact?
- Should broken link checking be optional/configurable?

---

### 5. Page Picker Data Source
**Question**: How does the page picker get the list of all pages?

**Current spec says**: "Searchable tree view shows the wiki page hierarchy"

**Needs clarification**:
- Does it query storage plugin for all pages?
- Or use cached index (DynamoDB, search index)?
- How is hierarchy built (parent-child relationships)?
- What if wiki has thousands of pages - pagination in picker?
- Should recently viewed/linked pages appear first?

---

### NEW: URL Mapping Database
**Question**: How is the short-code to S3 path mapping maintained?

**ANSWERED**: Pluggable URL mapping service

**Implementation**:
- Pluggable interface to support different cloud providers (not just DynamoDB)
- Maps: `short-code → { s3Path, pageTitle, status }`
- Table must be updated for:
  - Page renames: Update `pageTitle` field
  - Page moves: Update `s3Path` field
  - Page deletes: Update `status` to 'deleted'
- Fast lookup by short-code for URL resolution
- Optional reverse lookup by S3 path for admin tools

---

## 🟡 High Priority - Important for User Experience

### 6. Link Insertion Dialog Layout
**Question**: What does the link insertion dialog look like exactly?

**Current spec mentions**: "Tabs for 'Wiki Page' and 'External URL'"

**Needs design specification**:
- Two tabs side-by-side or dropdown selector?
- For wiki pages: Tree view, flat list with search, or both?
- For external URLs: Just URL+description fields?
- Should there be "Recent links" for quick re-insertion?
- Preview of link target before inserting?

---

### 7. Auto-URL Detection Trigger
**Question**: When exactly does auto-URL detection trigger?

**Current spec says**: "When URL is complete (ends with space or newline)"

**Needs clarification**:
- Only trigger on space, or also on punctuation (period, comma)?
- What about URLs inside sentences: "Visit https://example.com for info"?
- Should it trigger mid-sentence or only at boundaries?
- Can user opt-out of auto-detection globally?

---

### 8. Link Hover Tooltip Timing
**Question**: What are the exact timing and behavior for link tooltips?

**Current spec says**: "Appears within 500ms"

**Needs clarification**:
- 500ms hover delay before showing tooltip?
- How long does tooltip stay visible?
- Does it follow cursor or stay fixed near link?
- What if user hovers multiple links quickly - debounce behavior?

---

### 9. Page Picker Search Behavior
**Question**: How does search in the page picker work?

**Current spec says**: "Pages are filtered by title in real-time"

**Needs clarification**:
- Search by title only, or also by content keywords?
- Fuzzy search or exact match?
- Show page path/hierarchy in results?
- Highlight matched terms in results?
- Minimum characters before search activates (e.g., 3)?

---

### 10. Selected Text Link Behavior
**Question**: What exactly happens when text is selected before inserting link?

**Current spec says**: "Selected text becomes the link description"

**Needs clarification**:
- If user selects "click here" and inserts link, result is `[click here](url)`?
- What if selected text spans multiple lines or paragraphs?
- Should there be character limit for link text?
- What if selection includes existing link - replace or error?

---

### 11. External URL Validation Rules
**Question**: What makes a URL "valid"?

**Current spec says**: "Validation error shows 'Please enter a valid URL starting with http:// or https://'"

**Needs clarification**:
- Are other protocols allowed (ftp://, mailto:, tel:)?
- What about relative URLs or fragments (#anchor)?
- Strict URL format validation or lenient?
- Should system check if URL is accessible (HTTP HEAD request)?

---

### 12. Link Edit Keyboard Shortcut
**Question**: What activates edit mode for existing links?

**Current spec mentions**: "Ctrl+K" as edit link shortcut

**Needs clarification**:
- Does Ctrl+K work for both insert and edit?
- How does system know: cursor in link = edit, otherwise = insert?
- What if cursor is just after link (not in it)?
- Should there be a different shortcut for edit vs insert?

---

### 13. Multiple URL Conversion Options
**Question**: When multiple URLs are detected, how does batch conversion work?

**Current spec says**: "Batch conversion option 'Convert all X URLs to links'"

**Needs clarification**:
- Does system show preview of all detected URLs?
- Can user select which ones to convert (checkboxes)?
- Are descriptions auto-suggested for each?
- Or all converted with domain as description?

---

### 14. Copy Link Format Options
**Question**: What are the exact format options for copying links?

**Current spec lists**: Wiki link `[[Title]]`, Markdown `[Title](url)`, Full URL

**Needs clarification**:
- Should there be HTML format too: `<a href="...">Title</a>`?
- Plain text format: "Title - URL"?
- Can user set default copy format in preferences?
- Where in UI are these options (dropdown, context menu)?

---

### 15. Broken Link UI Indicator
**Question**: How exactly are broken links styled and indicated?

**Current spec says**: "Styled differently (e.g., red underline) with tooltip 'Broken link'"

**Needs clarification**:
- Red underline, red text, strikethrough, or icon?
- Tooltip on hover or always visible icon?
- Different styling for "page not found" vs "permission denied"?
- Should broken links be visible in editor preview or only published pages?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Link Anchor Support
**Question**: Can links target specific sections within pages?

**Not explicitly covered in spec**:
- Link to heading: `[Link](#heading-anchor)`?
- Combined: `[Link](/wiki/page#section)`?
- How are heading anchors generated (auto-slugify)?
- Should there be UI for selecting section within page picker?

---

### 17. Link Preview Cards
**Question**: Should hovering over internal links show page preview card?

**Not explicitly covered in spec**:
- Show first few lines of target page content?
- Show page metadata (last updated, author)?
- Show thumbnail if page has images?
- How is this different from simple tooltip?

---

### 18. Link Statistics and Analytics
**Question**: Should system track link usage?

**Not explicitly covered in spec**:
- "Most linked pages" report?
- "Orphaned pages" (no incoming links) detection?
- Link analytics for admins?
- Is this separate feature or part of links?

---

### 19. Link Suggestions Based on Context
**Question**: Should system suggest relevant links based on content?

**Not explicitly covered in spec**:
- While typing "vacation", suggest linking to "Family Vacations" page?
- AI/ML-based suggestions or keyword matching?
- How intrusive should suggestions be?

---

### 20. External Link Security Warnings
**Question**: Should external links have security indicators?

**Not explicitly covered in spec**:
- Icon indicating "external link"?
- Warning for non-HTTPS links?
- "Open in new tab" default for external links?
- Rel="noopener noreferrer" for security?

---

### 21. Link Redirect Tracking
**Question**: What if a linked page is moved or deleted?

**Not explicitly covered in spec**:
- Should system maintain redirects from old URL to new?
- Update all referring links automatically?
- Or leave as broken links for manual fixing?

---

### 22. Link Shortening/Aliasing
**Question**: Can users create short aliases for long URLs?

**Not explicitly covered in spec**:
- Create alias "latest-update" → "/wiki/updates/2026/jan/13"?
- Useful for newsletters or external sharing?
- Where are aliases managed?

---

### 23. Link Autocomplete Context Awareness
**Question**: Should `[[` autocomplete consider current location?

**Not explicitly covered in spec**:
- If editing page in "Projects" folder, prioritize sibling pages?
- Show recently edited pages first?
- Or always show all pages alphabetically?

---

### 24. Bidirectional Links (Backlinks)
**Question**: Can users see what pages link TO current page?

**Not explicitly covered in spec (might be separate feature)**:
- "What links here" section on each page?
- Show both outgoing and incoming links?
- Part of page metadata or separate panel?

---

### 25. Link Import from Other Formats
**Question**: When importing content, how are links handled?

**Not explicitly covered in spec**:
- Importing from Notion, Confluence, MediaWiki - convert links?
- What about HTML imports with `<a>` tags?
- Should there be link format converter tool?

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially link storage format and resolution strategy
2. **Create link storage format specification** - document exact markdown syntax for each link type
3. **Design the link insertion dialog mockup** - show both tabs and all fields
4. **Decide on GUID vs path-based links early** - this affects many other features

Would you like me to:
- Create a detailed link storage format specification?
- Design mockups for the link insertion dialog?
- Research pros/cons of GUID-based vs path-based links?
