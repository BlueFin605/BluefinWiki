# Feature Specification: Page Editor with Markdown Support

**Feature Branch**: `4-page-editor`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Create a page editor with markdown support"

## Cross-References

**Depends on:**
- [2-s3-storage-plugin.md](2-s3-storage-plugin.md) - Editor saves content to storage
- [11-page-permissions.md](11-page-permissions.md) - Edit permission required to access editor
- [16-page-metadata.md](16-page-metadata.md) - Status dropdown in editor toolbar

**Integrates with:**
- [5-page-links.md](5-page-links.md) - Supports internal wiki links in markdown
- [6-page-attachments.md](6-page-attachments.md) - Toolbar button to upload and insert attachments
- [15-page-comments.md](15-page-comments.md) - Uses same Markdown renderer
- [18-onboarding-help.md](18-onboarding-help.md) - Markdown help reference accessible from editor (US-13.2)

**Referenced by:**
- [19-error-handling-edge-cases.md](19-error-handling-edge-cases.md) - Story 3 handles network loss with localStorage drafts
- [12-mobile-experience.md](12-mobile-experience.md) - Mobile-optimized editor interface

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create New Page with Markdown Editor (Priority: P1)

A user creates a new wiki page using a markdown editor that provides both a text editing area and a live preview of the rendered markdown content.

**Why this priority**: Creating pages is the fundamental wiki operation. Without an editor, users cannot add content to the wiki.

**Independent Test**: Click "Create Page", enter title "Getting Started", type markdown content including headings, lists, and links, and verify both the raw markdown and live preview display correctly.

**Acceptance Scenarios**:

1. **Given** a user clicks "Create Page", **When** the editor loads, **Then** they see a split-pane view with markdown text area on left and live preview on right
2. **Given** the markdown editor is open, **When** a user types markdown syntax (e.g., `# Heading`), **Then** the live preview instantly updates showing the rendered HTML
3. **Given** a new page editor, **When** a user enters a page title and content, **Then** both title and content are saved when clicking "Save"
4. **Given** a page is being created, **When** a user selects a parent folder, **Then** the page is created within that folder's hierarchy
5. **Given** markdown content with images, **When** typed as `![alt](url)`, **Then** the preview shows the rendered image

---

### User Story 2 - Edit Existing Page Content (Priority: P1)

A user opens an existing page for editing, sees the current markdown content in the editor, makes changes, and saves the updated version back to the storage plugin.

**Why this priority**: Editing is essential for maintaining and improving wiki content. This completes the basic content lifecycle.

**Independent Test**: Open an existing page "Documentation", click "Edit", modify content by adding a new section, save, and verify the changes are persisted and visible to all users.

**Acceptance Scenarios**:

1. **Given** a user views an existing page, **When** they click "Edit" button, **Then** the editor opens pre-populated with the current markdown content
2. **Given** an edit in progress, **When** a user makes changes to the content, **Then** the preview pane updates in real-time showing the new rendering
3. **Given** edited content, **When** a user clicks "Save", **Then** changes are persisted via the storage plugin and the modified timestamp updates
4. **Given** an edit session, **When** a user clicks "Cancel", **Then** changes are discarded and the user returns to the page view
5. **Given** a page being edited, **When** the page has frontmatter metadata, **Then** the editor preserves the frontmatter while allowing content editing

---

### User Story 3 - Markdown Toolbar with Common Formatting (Priority: P1)

A user accesses a formatting toolbar in the editor that provides one-click buttons for common markdown syntax (bold, italic, headings, lists, links, images).

**Why this priority**: Toolbar reduces markdown learning curve, making the editor accessible to non-technical family members. Essential for family-friendly principle.

**Independent Test**: Click toolbar button for "Bold", verify markdown syntax `**text**` is inserted at cursor position, and preview shows bold text.

**Acceptance Scenarios**:

1. **Given** the editor is open, **When** a user selects text and clicks "Bold" button, **Then** the text is wrapped with `**` markers and preview shows bold
2. **Given** text is selected, **When** a user clicks "Link" button, **Then** a dialog prompts for URL and inserts `[selected text](url)` syntax
3. **Given** cursor position, **When** a user clicks "Heading" dropdown and selects H2, **Then** `## ` is inserted and preview shows heading level 2
4. **Given** the editor, **When** a user clicks "Unordered List" button, **Then** `- ` is inserted at the current line for list item
5. **Given** toolbar buttons, **When** used, **Then** keyboard shortcuts are also displayed (e.g., Ctrl+B for bold) and work equivalently

---

### User Story 4 - Live Preview with Split-Pane View (Priority: P1)

A user works in a split-pane editor showing raw markdown on one side and live rendered preview on the other, with synchronized scrolling between panes.

**Why this priority**: Live preview provides immediate feedback, essential for users learning markdown and for verifying complex formatting.

**Independent Test**: Type a long document with multiple sections, scroll in the markdown pane, and verify the preview pane scrolls to the corresponding position.

**Acceptance Scenarios**:

1. **Given** the editor is in split-pane mode, **When** a user scrolls in the markdown pane, **Then** the preview pane scrolls proportionally to show the corresponding content
2. **Given** split-pane view, **When** a user types markdown, **Then** the preview updates within 300ms (debounced for performance)
3. **Given** the editor, **When** a user toggles view mode, **Then** they can switch between split-pane, editor-only, and preview-only views
4. **Given** preview pane, **When** rendered, **Then** it uses the wiki's standard styling (same CSS as page view)
5. **Given** preview content, **When** containing internal wiki links, **Then** links are rendered but clicking them shows a message "Links disabled in preview mode"

---

### User Story 5 - Auto-Save Draft While Editing (Priority: P2)

The editor automatically saves the current content as a draft to browser local storage every 30 seconds, allowing recovery if the browser crashes or tab is accidentally closed.

**Why this priority**: Auto-save prevents data loss but isn't essential for MVP. Users can manually save frequently as a workaround.

**Independent Test**: Start editing a page, type content, wait 30 seconds, close the browser without saving, reopen the page editor, and verify a draft recovery prompt appears with the unsaved content.

**Acceptance Scenarios**:

1. **Given** a user is editing, **When** 30 seconds pass with changes, **Then** content is automatically saved to browser local storage as a draft
2. **Given** a draft exists, **When** a user returns to edit the same page, **Then** a notification prompts "Recover unsaved draft from [time]?"
3. **Given** draft recovery prompt, **When** a user clicks "Recover", **Then** the draft content loads into the editor
4. **Given** draft recovery prompt, **When** a user clicks "Discard", **Then** the draft is deleted and editor shows current saved content
5. **Given** a page is successfully saved, **When** save completes, **Then** the corresponding draft is automatically deleted from local storage

---

### User Story 6 - Insert Images and Attachments (Priority: P2)

A user uploads images or files through the editor, which stores them via the storage plugin and inserts the appropriate markdown syntax to reference the attachment.

**Why this priority**: Attachments are important for rich content but not essential for text-based MVP. Users can add images via URL initially.

**Independent Test**: Click "Insert Image" button, select a file from computer, verify upload progress, and confirm the markdown `![image](attachment-url)` is inserted and preview shows the image.

**Acceptance Scenarios**:

1. **Given** the editor toolbar, **When** a user clicks "Insert Image", **Then** a file picker dialog opens accepting image formats (jpg, png, gif, svg)
2. **Given** an image is selected, **When** upload begins, **Then** progress indicator shows upload percentage
3. **Given** upload completes, **When** image is stored via storage plugin, **Then** markdown syntax `![filename](attachment-id)` is inserted at cursor
4. **Given** the preview pane, **When** displaying image markdown, **Then** the actual uploaded image renders in preview
5. **Given** attachment upload, **When** file exceeds 10MB, **Then** error message shows "File too large. Maximum size is 10MB"

---

### User Story 7 - Markdown Syntax Help and Cheat Sheet (Priority: P2)

A user accesses a markdown syntax reference guide within the editor showing common formatting examples and syntax.

**Why this priority**: Helps users learn markdown but not essential as toolbar provides common operations. Online markdown guides are readily available.

**Independent Test**: Click "Markdown Help" button in editor, verify a panel or modal displays with markdown syntax examples (headings, bold, italic, lists, links, images, code blocks).

**Acceptance Scenarios**:

1. **Given** the editor is open, **When** a user clicks "Markdown Help" or "?" button, **Then** a help panel slides in showing markdown syntax reference
2. **Given** the help panel, **When** displayed, **Then** it shows examples for common markdown syntax with rendered previews
3. **Given** help panel examples, **When** a user clicks "Copy" next to an example, **Then** the markdown syntax is copied to clipboard
4. **Given** the help panel, **When** user clicks outside or presses Escape, **Then** the panel closes
5. **Given** help content, **When** displayed, **Then** it includes keyboard shortcuts for toolbar operations

---

### User Story 8 - Preview Before Publishing (Priority: P1)

Before saving a new or edited page, a user can preview exactly how the page will appear to readers, including the page layout, navigation, and styling.

**Why this priority**: Final preview prevents publishing mistakes and ensures content looks correct in context. Essential for quality control.

**Independent Test**: Edit a page with complex formatting, click "Preview" button, verify the preview shows the full page layout (header, navigation, breadcrumbs, content, footer) exactly as it will appear after saving.

**Acceptance Scenarios**:

1. **Given** a user is editing, **When** they click "Preview" button, **Then** the editor switches to full-page preview mode showing final page layout
2. **Given** preview mode, **When** displayed, **Then** all page elements render (breadcrumbs, title, content, metadata) using production styling
3. **Given** preview mode, **When** active, **Then** buttons show "Back to Editing" and "Publish" for navigation
4. **Given** preview with internal links, **When** clicked, **Then** links work but show a banner "Preview Mode - changes not saved"
5. **Given** preview mode, **When** user clicks "Publish", **Then** content is saved and user is redirected to the published page view

---

### User Story 9 - Edit Page Metadata (Title, Tags, Description) (Priority: P2)

A user edits page metadata including title, tags, and description through the editor interface, which updates the frontmatter when the page is saved.

**Why this priority**: Metadata helps with organization and search but isn't essential for basic page editing. Users can edit frontmatter directly if needed.

**Independent Test**: Open page editor, click "Page Settings", update title to "New Title", add tags "project, active", save, and verify frontmatter contains updated metadata.

**Acceptance Scenarios**:

1. **Given** the editor is open, **When** a user clicks "Page Settings" or "Metadata" button, **Then** a panel shows editable fields for title, tags, and description
2. **Given** metadata panel, **When** a user updates the title, **Then** the page title updates in frontmatter and in the page header display
3. **Given** tags field, **When** a user types tags separated by commas, **Then** tags are saved as an array in frontmatter `tags: [tag1, tag2]`
4. **Given** description field, **When** populated, **Then** it's saved in frontmatter and used for page meta description (SEO)
5. **Given** metadata changes, **When** saved, **Then** the frontmatter is correctly formatted YAML at the top of the markdown file

---

### User Story 10 - Concurrent Edit Warning (Priority: P3)

When multiple users are editing the same page simultaneously, the system detects this and warns users to prevent overwriting each other's changes.

**Why this priority**: Concurrent editing is rare in family wiki context. Nice to have for safety but not critical for MVP.

**Independent Test**: User A opens page for editing, User B opens same page for editing, User A saves changes, User B attempts to save, and User B sees warning "Page was modified by another user. Review changes before saving."

**Acceptance Scenarios**:

1. **Given** a user opens a page for editing, **When** editor loads, **Then** the system records the page's current version/timestamp
2. **Given** another user saves changes to the same page, **When** the first user attempts to save, **Then** system detects version mismatch
3. **Given** version conflict detected, **When** user tries to save, **Then** warning modal shows "Page modified by [user] at [time]. Review changes?"
4. **Given** conflict warning, **When** user clicks "Show Differences", **Then** a diff view shows their changes vs. current saved version
5. **Given** conflict resolution, **When** user chooses "Overwrite" or "Merge Manually", **Then** appropriate action is taken and user is informed of the outcome

---

### Edge Cases

- What happens when a user pastes content with HTML tags? HTML is escaped and displayed as text (security), or optionally sanitized if HTML support is enabled.
- What happens when markdown content is extremely long (50,000+ words)? Editor switches to editor-only mode (no live preview) for performance, with manual refresh preview option.
- What happens when a user tries to insert an image link to an external URL with invalid protocol (e.g., javascript:)? URL validation rejects it with error "Invalid URL protocol. Use http:// or https://".
- What happens when browser crashes while editing before auto-save? User loses up to 30 seconds of work since last auto-save; recoverable draft loads on next editor open.
- What happens when a user types markdown with syntax errors (e.g., unclosed code block)? Preview renders as-is showing the error visually; markdown is forgiving and doesn't break.
- What happens when storage plugin fails during save operation? Error message shows "Failed to save. Please try again or copy your content to a safe location."
- What happens when a user uploads an attachment with duplicate filename? System generates unique attachment GUID, avoiding filename collision; original name stored in metadata.
- What happens when preview pane rendering takes more than 2 seconds (complex markdown)? Loading spinner shows with message "Rendering preview..." and preview updates when complete.
- What happens when a user clicks "Back" browser button while editing unsaved changes? Browser prompts "Leave site? Changes you made may not be saved" using beforeunload event.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a markdown editor component for creating and editing page content
- **FR-002**: Editor MUST support CommonMark markdown syntax specification
- **FR-003**: Editor MUST display live preview of rendered markdown with maximum 300ms update delay
- **FR-004**: Editor MUST provide split-pane view showing markdown source and preview side-by-side
- **FR-005**: Editor MUST support view mode toggle (split-pane, editor-only, preview-only)
- **FR-006**: Editor MUST provide formatting toolbar with buttons for bold, italic, headings, lists, links, images, code blocks
- **FR-007**: Editor MUST support keyboard shortcuts for common formatting operations (Ctrl+B, Ctrl+I, etc.)
- **FR-008**: Editor MUST preserve YAML frontmatter when editing page content
- **FR-009**: Editor MUST validate markdown before saving to ensure well-formed frontmatter
- **FR-010**: Editor MUST save page content via storage plugin's `createPage()` or `updatePage()` methods
- **FR-011**: Editor MUST update page metadata (title, modified timestamp, author) on save
- **FR-012**: Editor MUST implement auto-save to browser local storage every 30 seconds
- **FR-013**: Editor MUST prompt to recover draft if unsaved changes exist when opening editor
- **FR-014**: Editor MUST clear draft from local storage after successful save
- **FR-015**: Editor MUST support image upload through storage plugin's `uploadAttachment()` method
- **FR-016**: Editor MUST insert correct markdown syntax for uploaded attachments
- **FR-017**: Editor MUST validate uploaded file types and sizes (images <10MB)
- **FR-018**: Editor MUST provide markdown syntax help/cheat sheet accessible from toolbar
- **FR-019**: Editor MUST support full-page preview mode showing final page layout before publishing
- **FR-020**: Editor MUST allow editing page metadata (title, tags, description) through UI panel
- **FR-021**: Editor MUST enforce role-based permissions (Editor/Admin can edit, Viewer cannot)
- **FR-022**: Editor MUST warn users before leaving page with unsaved changes
- **FR-023**: Editor MUST detect concurrent edits and warn before overwriting changes (P3)
- **FR-024**: Editor MUST sanitize user input to prevent XSS attacks in preview
- **FR-025**: Editor MUST support responsive design for tablet and mobile editing

### Key Entities

- **EditorState**: Represents the current state of the editor session
  - Attributes: pageId, content (markdown string), frontmatter (object), isDirty (boolean), lastSaved (timestamp), currentView (split/editor/preview), cursorPosition
  - Storage: In-memory state, draft auto-saved to browser local storage
  - Relationships: One editor state per page being edited per user session

- **Draft**: Represents auto-saved content in browser local storage
  - Attributes: pageId, content, frontmatter, savedAt (timestamp), userId
  - Storage: Browser local storage with key pattern `draft:${pageId}:${userId}`
  - Relationships: One draft per page per user, cleared on successful save

- **EditorSettings**: User preferences for editor behavior
  - Attributes: userId, defaultView (split/editor/preview), theme (light/dark), autoSaveInterval (seconds), showHelp (boolean)
  - Storage: Browser local storage or user profile
  - Relationships: One settings object per user

- **UploadedAttachment**: Represents a file attached to a page via editor
  - Attributes: attachmentId (GUID), pageId, filename, contentType, size, uploadedAt, uploadedBy
  - Storage: Managed by storage plugin, metadata tracked separately
  - Relationships: Multiple attachments per page

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Editor loads and becomes interactive within 2 seconds on modern browsers
- **SC-002**: Live preview updates within 300ms of user stopping typing (debounced)
- **SC-003**: Page save operation completes within 3 seconds for pages up to 100KB content
- **SC-004**: Auto-save executes successfully every 30 seconds without impacting editor performance
- **SC-005**: Draft recovery correctly restores 100% of unsaved content when browser is reopened
- **SC-006**: Formatting toolbar operations insert correct markdown syntax with 100% accuracy
- **SC-007**: Image uploads complete within 10 seconds for files up to 10MB
- **SC-008**: Editor maintains responsive performance for documents up to 50,000 words
- **SC-009**: Preview rendering matches final page display with 100% fidelity (same CSS)
- **SC-010**: Editor works correctly on desktop (Chrome, Firefox, Safari, Edge) and tablets
- **SC-011**: Keyboard shortcuts work for all standard formatting operations (bold, italic, headings, lists)
- **SC-012**: Markdown syntax help panel loads within 500ms when requested
- **SC-013**: Concurrent edit detection prevents data loss in 100% of conflict scenarios
- **SC-014**: Editor prevents navigation with unsaved changes 100% of the time via browser prompt
- **SC-015**: XSS prevention blocks all malicious script injection attempts in preview and save

## Assumptions

- Markdown editor will use a proven library (e.g., CodeMirror, Monaco Editor, or similar) rather than building from scratch
- Preview rendering uses same markdown parser as page display for consistency
- Browser local storage is available and has at least 5MB capacity for drafts
- Users primarily edit on desktop or tablet; phone editing is supported but not optimized
- Average page content is under 10,000 words; larger documents supported but may require editor-only mode
- Storage plugin implements attachment upload functionality as specified
- Auto-save interval of 30 seconds balances data safety with performance/storage
- Concurrent editing is rare enough that last-write-wins with warning is acceptable (no real-time collaboration)
- Markdown syntax is sufficient for family wiki needs (no need for WYSIWYG editor initially)
- Preview pane scrolling can be synchronized with reasonable accuracy (not pixel-perfect)
- Users have modern browsers with ES6+ JavaScript support
- Editor state is not persisted server-side (only in browser local storage)
- Frontmatter YAML is simple enough for automated parsing and preservation

## Out of Scope

The following are explicitly **not** included in this specification:

- WYSIWYG rich text editor (separate editor module could be added)
- Real-time collaborative editing with multiple cursors (future enhancement)
- Version history or diff viewing within editor (separate feature)
- Advanced markdown extensions (diagrams, math, custom blocks) (future enhancements)
- Offline editing with sync when reconnected (future PWA enhancement)
- AI-assisted writing or content suggestions (future enhancement)
- Grammar and spell checking beyond browser built-in (future enhancement)
- Page templates or boilerplate insertion (separate feature module)
- Custom markdown shortcuts or macros (future enhancement)
- Export editor content to other formats (PDF, DOCX) (separate export module)
- Editor plugins or extensions system (future if needed)
- Source control integration (commit messages, blame) within editor (separate feature)
- Advanced attachment management (crop, resize, optimize) (future enhancement)
- Voice-to-text dictation (future accessibility enhancement)
- Markdown linting or style checking (future quality feature)

## Constitutional Compliance

This feature aligns with the BlueFinWiki Constitution:

- **Content-First Architecture (Principle II)**: Editor works with standard markdown files enabling data portability
- **Markdown File Format (Non-Negotiable #5)**: Editor creates and edits .md files with YAML frontmatter as required
- **Family-Friendly Experience (Principle IV)**: Toolbar and live preview make editing accessible to all skill levels
- **Simplicity (Principle III)**: Straightforward markdown editor without overwhelming features
- **Pluggable Architecture (Principle I)**: Editor integrates with storage plugin via interface; could support alternative editor modules
- **Role-Based Access (Principle VI)**: All authenticated users can edit; admin features restricted to Admin role
- **Mobile-Responsive (Principle IV)**: Editor works on tablets and phones for family access anywhere

## Technical Notes

### Editor Library Options

Consider these proven markdown editor libraries:
- **CodeMirror 6**: Modern, performant, extensible code editor
- **Monaco Editor**: VS Code's editor, full-featured but heavier
- **react-markdown-editor-lite**: Lightweight React markdown editor with preview
- **SimpleMDE/EasyMDE**: Simple, user-friendly markdown editor

### Split-Pane Layout

```
┌─────────────────────────────────────────┐
│  Toolbar: [B][I][H][List][Link][Image]  │
├──────────────────┬──────────────────────┤
│                  │                      │
│  # My Page       │  My Page            │
│                  │  ----------------    │
│  ## Section 1    │  Section 1          │
│                  │                      │
│  - List item     │  • List item        │
│  - Another       │  • Another          │
│                  │                      │
│  [Markdown Edit] │  [Live Preview]     │
│                  │                      │
└──────────────────┴──────────────────────┘
```

### Auto-Save Flow

```typescript
// Debounced auto-save every 30 seconds
const autoSave = debounce(() => {
  const draft = {
    pageId,
    content: editorContent,
    frontmatter: parsedFrontmatter,
    savedAt: Date.now(),
    userId: currentUser.id
  };
  localStorage.setItem(`draft:${pageId}:${userId}`, JSON.stringify(draft));
}, 30000);

// On editor mount, check for draft
const draftKey = `draft:${pageId}:${userId}`;
const draft = localStorage.getItem(draftKey);
if (draft && JSON.parse(draft).savedAt > lastSavedTimestamp) {
  showDraftRecoveryPrompt();
}
```

### Markdown Toolbar Actions

```typescript
const toolbarActions = {
  bold: () => wrapSelection('**', '**'),
  italic: () => wrapSelection('*', '*'),
  heading: (level) => insertAtLineStart('#'.repeat(level) + ' '),
  list: () => insertAtLineStart('- '),
  link: () => {
    const url = prompt('Enter URL:');
    wrapSelection('[', `](${url})`);
  },
  image: () => openImageUploadDialog()
};
```


---

## Accessibility Requirements (WCAG 2.1 AA)

### Keyboard Navigation
- All toolbar buttons accessible via Tab key
- Keyboard shortcuts for common formatting:
  - Ctrl+B (Bold), Ctrl+I (Italic)
  - Ctrl+K (Link), Ctrl+Shift+I (Image)
  - Ctrl+1-6 (Headings)
  - Ctrl+S (Save), Ctrl+P (Preview)
- Arrow keys navigate within editor
- Escape exits fullscreen mode
- Tab in editor inserts spaces (not focus change)

### Screen Reader Support
- Editor has `role="textbox"` with `aria-multiline="true"`
- Toolbar buttons have clear `aria-label` attributes
- Preview pane has `role="region"` with `aria-label="Markdown preview"`
- Save confirmation announced: "Page saved successfully"
- Auto-save status announced periodically

### Visual Design
- Toolbar buttons have 4.5:1 contrast ratio
- Active/selected buttons clearly indicated
- Focus indicators visible on all controls
- Split-pane divider clearly visible
- Preview matches page rendering exactly

### Mobile Accessibility
- Toolbar buttons minimum 44x44px touch targets
- Virtual keyboard doesn't obscure editor
- Preview toggle easy to access
- Formatting menu accessible on mobile
