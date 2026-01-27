# Clarification Questions: Page Editor

**Feature**: Page Editor with Markdown Support  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Editor Library Choice
**Question**: What markdown editor library/component will be used?

**Why this matters**: This is a fundamental architectural decision that affects all other editor features.

**Needs clarification**:
- Options: CodeMirror, Monaco Editor, SimpleMDE, custom built?
- Does it need to support plugins/extensions?
- Does it need collaborative editing (future)?
- What about mobile support?
- License compatibility with project?

---

### 2. Auto-Save vs Draft Save
**Question**: How do auto-save and explicit save interact?

**Current spec says**: "Editor MUST implement auto-save to browser local storage every 30 seconds"

**Needs clarification**:
- Does auto-save replace manual save, or complement it?
- Is draft in localStorage separate from "real" save to storage plugin?
- When user clicks "Save", does it clear the draft and save to backend?
- Can user continue editing while save to backend is in progress?
- What if backend save fails but draft exists?

---

### 3. Concurrent Edit Detection Mechanism
**Question**: How exactly is concurrent editing detected?

**Current spec mentions**: "System detects version mismatch" and "Optimistic locking with ETags"

**Needs clarification**:
- When user opens editor, is page version/ETag cached?
- On save attempt, does system check current version against cached version?
- What's the exact flow:
  1. Open editor → Store ETag "abc123"
  2. Save attempt → Check if current ETag still "abc123"
  3. If different → Show conflict dialog?
- Does this work across all storage plugins (S3, GitHub)?
- How long is the ETag valid (session only, or persisted)?

---

### 4. Preview Security and XSS Prevention
**Question**: How is user markdown content sanitized to prevent XSS attacks in preview?

**Current spec says**: "Editor MUST sanitize user input to prevent XSS attacks in preview"

**Needs clarification**:
- What sanitization library (DOMPurify, marked with sanitizer)?
- Are HTML tags allowed in markdown or stripped completely?
- What about `<script>` tags, `onclick` attributes, `javascript:` URLs?
- Should `<iframe>` be allowed for embedded content?
- Different sanitization rules for preview vs published page?

---

### 5. Frontmatter Editing Boundary
**Question**: Can users edit frontmatter directly in the markdown editor, or only through metadata panel?

**Current spec says**: "Editor MUST preserve YAML frontmatter when editing page content"

**Needs clarification**:
- Is frontmatter visible in the markdown editor pane?
- Can power users edit YAML directly?
- Or is frontmatter hidden and only editable via "Page Settings" panel?
- What if user accidentally breaks frontmatter YAML syntax?
- Should there be "Raw" mode showing everything vs "Content" mode hiding frontmatter?

---

## 🟡 High Priority - Important for User Experience

### 6. Editor Toolbar Button Set
**Question**: What is the complete set of toolbar buttons?

**Current spec lists**: "Bold, italic, headings, lists, links, images, code blocks"

**Needs complete definition**:
- Headings: H1-H6 dropdown or multiple buttons?
- Lists: Separate buttons for ordered/unordered?
- Code: Inline code and code blocks separate?
- What about: Quote, Horizontal rule, Table, Strikethrough, Highlight?
- Should toolbar be customizable by user?

---

### 7. Keyboard Shortcuts Complete List
**Question**: What are ALL keyboard shortcuts?

**Current spec mentions**: "Ctrl+B for bold" as example

**Needs complete definition**:
- Ctrl+B: Bold
- Ctrl+I: Italic
- Ctrl+K: Insert link
- Ctrl+S: Save
- Ctrl+Shift+P: Preview toggle
- Ctrl+?: Help
- What else? Should be documented clearly.

---

### 8. Split-Pane Resize and Preferences
**Question**: Can users resize the split pane and save preferences?

**Current spec mentions**: "Split-pane view" but not customization

**Needs clarification**:
- Can users drag divider to resize editor/preview ratio?
- Is preference saved per-user (50/50, 70/30, etc.)?
- Separate from view mode preference (split/editor/preview)?
- Should there be preset layouts?

---

### 9. Image Upload During Edit vs Create
**Question**: Does image upload work the same for new pages vs editing existing pages?

**Current spec mentions**: "Insert Image" inserts `![filename](attachment-id)`

**Needs clarification**:
- For NEW pages (not saved yet), where do uploaded images go?
- Are they stored in temp location until page is saved?
- What if user cancels without saving - are temp uploads cleaned up?
- Or must page be saved before allowing image uploads?

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
**Question**: How does user know auto-save is working?

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
- Should internal wiki links open in new tab?
- Or completely disabled with cursor change?
- What about external links - open in new tab or blocked?
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
- Or GitHub Flavored Markdown (GFM) with tables, task lists, strikethrough?
- What about extensions: footnotes, definition lists, math equations?
- Should there be a markdown capabilities document?

---

### 15. Editor Responsive Design Breakpoints
**Question**: How does editor work on different screen sizes?

**Current spec says**: "Support responsive design for tablet and mobile"

**Needs clarification**:
- Tablet: Keep split-pane with narrower width?
- Mobile: Default to editor-only mode with preview button?
- Can mobile users switch between editor/preview easily?
- Is toolbar simplified on mobile?
- Should there be mobile-specific features (e.g., photo from camera)?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Undo/Redo Functionality
**Question**: Is undo/redo built into editor or separate?

**Not explicitly covered in spec**:
- Should editor have its own undo/redo stack?
- Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y?
- How many undo levels?
- Does undo survive page reload (from draft)?

---

### 17. Find and Replace in Editor
**Question**: Is there find/replace functionality in editor?

**Not explicitly covered in spec**:
- Ctrl+F to find text in current document?
- Find and replace dialog?
- Regex support for power users?
- Essential for editing long documents?

---

### 18. Word Count and Statistics
**Question**: Should editor show word count and other stats?

**Not explicitly covered in spec**:
- Real-time word count display?
- Character count, line count?
- Reading time estimate?
- Where displayed (status bar, info panel)?

---

### 19. Markdown Template Insertion
**Question**: Can users insert predefined markdown templates?

**Not explicitly covered in spec**:
- "Insert table template" (3x3 markdown table)?
- "Insert meeting notes template"?
- "Insert code block with language"?
- Part of toolbar or help panel?

---

### 20. Fullscreen Editor Mode
**Question**: Can editor expand to fullscreen for distraction-free editing?

**Not explicitly covered in spec**:
- Fullscreen button in toolbar?
- F11 or custom shortcut?
- Does fullscreen hide wiki navigation/header?
- Still show preview or editor-only fullscreen?

---

### 21. Syntax Highlighting in Code Blocks
**Question**: Is code syntax highlighting supported in preview?

**Not explicitly covered in spec**:
- Should code blocks like ```javascript be syntax highlighted?
- What highlighting library (Prism, Highlight.js)?
- What languages supported?
- Light vs dark theme for code?

---

### 22. Emoji Picker
**Question**: Is there an emoji picker in the editor?

**Not explicitly covered in spec**:
- Toolbar button for emoji picker?
- Or users type `:smile:` syntax?
- Native OS emoji picker (Ctrl+. on Windows)?

---

### 23. Drag and Drop Text/Content
**Question**: Can users drag text or content blocks around in editor?

**Not explicitly covered in spec**:
- Drag to reorder paragraphs?
- Or just standard text selection/cut/paste?
- Should there be block-level drag handles?

---

### 24. Spellcheck Configuration
**Question**: Is spellcheck enabled in the editor?

**Not explicitly covered in spec**:
- Browser native spellcheck or custom?
- Can be toggled on/off?
- Multiple language support?

---

### 25. Dark Mode Editor Theme
**Question**: Does editor support dark mode?

**Not explicitly covered in spec**:
- Follow system theme?
- User toggle in settings?
- Separate themes for editor and preview?
- What about syntax highlighting in dark mode?

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
