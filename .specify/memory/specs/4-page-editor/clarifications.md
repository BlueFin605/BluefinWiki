# Clarification Questions: Page Editor

**Feature**: Page Editor with Markdown Support  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

### NEW: Page URL After Save
**Question**: What URL structure is used for saved pages?

**ANSWERED**: Pages use short-code GUID URL format

**Implementation**:
- New page created with short-code GUID
- URL format: `/pages/{short-code}/Page Title`
- After save, user redirected to page view at this URL
- Short-code registered in URL mapping service
- Mapping links short-code to S3 path
- Page title in URL updated when page renamed
- Short-code never changes (stable permalinks)

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Editor Library Choice
**Question**: What markdown editor library/component will be used?

**Why this matters**: This is a fundamental architectural decision that affects all other editor features.

**ANSWERED**:
- Must be a WYSIWYG editor
- Must work in Angular
- Must handle frontmatter (hide it from users)
- Must support Mermaid diagrams
- Must be actively maintained
- Must be free/open source
- Does NOT need collaborative editing for MVP

---

### 2. Auto-Save vs Draft Save
**Question**: How do auto-save and explicit save interact?

**ANSWERED**:
- NO auto-save functionality
- Explicit save button only
- Users must manually click save to persist changes
- Note: This conflicts with previous spec that mentioned auto-save. Explicit save only is the correct requirement.

---

### 3. Concurrent Edit Detection Mechanism
**Question**: How exactly is concurrent editing detected?

**ANSWERED**:
- Optimistic locking using ETags
- Flow:
  1. Open editor → Store/cache current ETag
  2. Save attempt → Include ETag in save request
  3. Backend validates ETag matches current version
  4. If different → Show conflict dialog/error
- Must work across all storage plugins (S3, GitHub, etc.)
- ETag valid for editing session

---

### 4. Preview Security and XSS Prevention
**Question**: How is user markdown content sanitized to prevent XSS attacks in preview?

**ANSWERED**:
- Follow security best practices within the practicalities of a wiki
- Prevent CSS injection
- Prevent executing any applications or scripts
- Strip/block `<script>` tags
- Strip/block event handlers (`onclick`, etc.)
- Block `javascript:` URLs
- Sanitization library to be determined (DOMPurify recommended)
- Same security rules for preview and published pages

---

### 5. Frontmatter Editing Boundary
**Question**: Can users edit frontmatter directly in the markdown editor, or only through metadata panel?

**ANSWERED**:
- Frontmatter is hidden from users in the editor
- Users do NOT see frontmatter in the markdown editor pane
- Metadata is hidden for MVP
- Note: Frontmatter may be editable through metadata panel in future, but not exposed in editor for MVP

---

## 🟡 High Priority - Important for User Experience

### 6. Editor Toolbar Button Set
**Question**: What is the complete set of toolbar buttons?

**Current spec lists**: "Bold, italic, headings, lists, links, images, code blocks"

**ANSWERED**:
- Headings: H1-H6 dropdown
- Lists: Separate buttons for ordered/unordered
- Code: Inline code and code blocks separate
- Follow best practices for toolbar button set
- Standard functionality for markdown editors

---

### 7. Keyboard Shortcuts Complete List
**Question**: What are ALL keyboard shortcuts?

**Current spec mentions**: "Ctrl+B for bold" as example

**ANSWERED**:
- Use standard Windows keyboard shortcuts
- Include common shortcuts:
  - Ctrl+B: Bold
  - Ctrl+I: Italic
  - Ctrl+K: Insert link
  - Ctrl+S: Save
  - Ctrl+Shift+P: Preview toggle
  - Ctrl+Z: Undo
  - Ctrl+Y or Ctrl+Shift+Z: Redo
  - Ctrl+F: Find
  - Ctrl+H: Find and Replace
- Follow standard conventions for consistency

---

### 8. Split-Pane Resize and Preferences
**Question**: Can users resize the split pane and save preferences?

**Current spec mentions**: "Split-pane view" but not customization

**ANSWERED**:
- Users can resize the split pane divider
- Preferences are remembered (saved per-user)
- User can drag divider to adjust editor/preview ratio
- Preference persists across sessions

---

### 9. Image Upload During Edit vs Create
**Question**: Does image upload work the same for new pages vs editing existing pages?

**Current spec mentions**: "Insert Image" inserts `![filename](attachment-id)`

**ANSWERED**:
- Images are stored in the same directory as the page
- Images use the filename as the identifier
- Storage location is consistent for both new and existing pages

---

### 10. Draft Recovery Timeout
**Question**: How long do drafts persist in localStorage?

**Current spec says**: "Prompt to recover draft" but not duration

**Needs clarification**:
- Do drafts expire after certain time (24 hours, 7 days)?
- Or persist indefinitely until manually discarded?
- What if user has drafts for 10 different pages?
- Should there be a "Drafts" management panel?

---

### 11. Auto-Save Indicator
**Question**: How does user know auto-save is working? no autosave

**Current spec mentions**: "Auto-save every 30 seconds" but not feedback

**Needs clarification**:
- Should there be "Last saved: 15 seconds ago" indicator?
- Or "Saving..." / "Draft saved" toast notification?
- Or subtle icon change (e.g., cloud icon)?
- Should failed auto-save be prominently indicated?

---

### 12. Preview Mode Link Clicking
**Question**: What happens when user clicks links in preview?

**Current spec says**: "Links disabled in preview mode" with message

**Needs clarification**:
- Should internal wiki links open in new tab? all links should always open in new tab
- Or completely disabled with cursor change?
- What about external links - open in new tab or blocked?all links should always open in new tab
- Should there be "Open in new tab" option on right-click?

---

### 13. File Upload Size Limits
**Question**: Besides 10MB for images, what are other file size limits?

**Current spec says**: "File exceeds 10MB" for images

**Needs clarification**:
- Are documents (PDF, DOCX) same 10MB limit or different?
- Videos mentioned in attachments spec - what limit?
- Total attachments per page limit?
- Should limits be configurable or hardcoded?

---

### 14. Markdown Flavor and Extensions
**Question**: What exact markdown flavor is supported?

**Current spec says**: "CommonMark markdown syntax specification"

**Needs clarification**:
- Pure CommonMark only?
- Or GitHub Flavored Markdown (GFM) with tables, task lists, strikethrough? github flavoired please
- What about extensions: footnotes, definition lists, math equations? yes please
- Should there be a markdown capabilities document? yes

---

### 15. Editor Responsive Design Breakpoints
**Question**: How does editor work on different screen sizes?

**Current spec says**: "Support responsive design for tablet and mobile"

**ANSWERED**:
- Must be a responsive website
- Support tablet and mobile devices
- Layout should adapt to different screen sizes
- Follow responsive design best practices

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Undo/Redo Functionality
**Question**: Is undo/redo built into editor or separate?

**ANSWERED**:
- Editor must support undo/redo functionality
- Standard keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y or Ctrl+Shift+Z (redo)
- Should have reasonable undo stack depth
- Follow best practices for undo/redo implementation

---

### 17. Find and Replace in Editor
**Question**: Is there find/replace functionality in editor?

**ANSWERED**:
- Support find and replace functionality
- Ctrl+F for find, Ctrl+H for find and replace
- Follow best practices for find/replace implementation
- Important for editing longer documents

---

### 18. Word Count and Statistics
**Question**: Should editor show word count and other stats?

**ANSWERED**:
- Word count and stats would be nice to have
- Include basic statistics like word count, character count
- Display in status bar or appropriate location
- Nice-to-have feature, not critical for MVP

---

### 19. Markdown Template Insertion
**Question**: Can users insert predefined markdown templates?

**ANSWERED**:
- No templates for MVP
- Template functionality deferred to post-MVP
- Focus on core editing features first

---

### 20. Fullscreen Editor Mode
**Question**: Can editor expand to fullscreen for distraction-free editing?

**ANSWERED**:
- No fullscreen mode for MVP
- Fullscreen functionality deferred to post-MVP
- Keep MVP scope focused on essential features

---

### 21. Syntax Highlighting in Code Blocks
**Question**: Is code syntax highlighting supported in preview?

**ANSWERED**:
- No syntax highlighting for MVP
- Syntax highlighting deferred to post-MVP
- Code blocks will be displayed without highlighting initially

---

### 22. Emoji Picker
**Question**: Is there an emoji picker in the editor?

**ANSWERED**:
- Support emojis in the editor
- Users can use native OS emoji picker or type emoji directly
- Standard emoji support in markdown

---

### 23. Drag and Drop Text/Content
**Question**: Can users drag text or content blocks around in editor?

**ANSWERED**:
- Support drag and drop functionality
- Follow best practices for drag and drop implementation
- Enable intuitive content manipulation

---

### 24. Spellcheck Configuration
**Question**: Is spellcheck enabled in the editor?

**ANSWERED**:
- No spellchecker in MVP
- Spellcheck functionality deferred to post-MVP
- Users can rely on browser's native spellcheck if available

---

### 25. Dark Mode Editor Theme
**Question**: Does editor support dark mode?

**ANSWERED**:
- Dark mode should follow system theme
- Automatically adapt to user's OS theme preference
- No separate toggle needed for MVP
- Consistent with system-wide dark mode settings

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially editor library choice and security considerations
2. **Create a complete keyboard shortcut reference** - document all shortcuts for consistency
3. **Define the exact markdown flavor support** - prevents confusion about what syntax works
4. **Design the concurrent edit conflict resolution UI** - this is complex and needs careful UX design

Would you like me to:
- Research and recommend editor libraries?
- Create a complete keyboard shortcuts specification?
- Design the conflict resolution UI flow?
