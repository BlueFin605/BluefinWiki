# Editor Components

This directory contains the markdown editor components for the BlueFinWiki page editor feature.

## Components

### MarkdownEditor

A CodeMirror 6-based markdown editor with syntax highlighting, line numbers, and keyboard shortcuts.

**Features:**
- Markdown syntax highlighting
- Line numbers and active line highlighting
- Undo/redo history (Ctrl+Z, Ctrl+Shift+Z)
- Save shortcut (Ctrl+S / Cmd+S)
- Formatting keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, etc.)
- Auto-indentation and bracket matching
- Editable/read-only mode support
- Toolbar action support via ref

**Usage:**
```tsx
import { MarkdownEditor, MarkdownEditorRef } from '@/components/editor';

const editorRef = useRef<MarkdownEditorRef>(null);

<MarkdownEditor
  ref={editorRef}
  initialValue="# Hello World"
  onChange={(content) => console.log(content)}
  onSave={() => console.log('Saved!')}
  editable={true}
/>

// Apply toolbar action programmatically
editorRef.current?.applyToolbarAction('bold');
```

**Props:**
- `initialValue?: string` - Initial content for the editor
- `onChange?: (value: string) => void` - Callback when content changes
- `onSave?: () => void` - Callback when Ctrl+S is pressed
- `editable?: boolean` - Whether the editor is editable (default: true)

**Ref Methods:**
- `applyToolbarAction(action: ToolbarAction)` - Apply a formatting action
- `getView()` - Get the CodeMirror EditorView instance

### MarkdownToolbar

A toolbar with markdown formatting buttons and keyboard shortcuts.

**Features:**
- Text formatting: Bold, Italic, Strikethrough
- Headers: H1-H6 dropdown menu
- Lists: Unordered, ordered, task lists
- Links and images
- Code: Inline code and code blocks
- Keyboard shortcuts integrated with editor
- Disabled state support

**Usage:**
```tsx
import { MarkdownToolbar } from '@/components/editor';

<MarkdownToolbar
  onAction={(action) => editorRef.current?.applyToolbarAction(action)}
  disabled={false}
/>
```

**Props:**
- `onAction: (action: ToolbarAction) => void` - Callback when toolbar button is clicked
- `disabled?: boolean` - Whether toolbar buttons are disabled

**Toolbar Actions:**
- `bold`, `italic`, `strikethrough` - Text formatting
- `h1`, `h2`, `h3`, `h4`, `h5`, `h6` - Headers
- `ul`, `ol`, `task` - Lists
- `link`, `image` - Links and media
- `code`, `codeblock` - Code formatting

**Keyboard Shortcuts:**
- `Ctrl+B` / `Cmd+B` - Bold
- `Ctrl+I` / `Cmd+I` - Italic
- `Ctrl+Shift+X` / `Cmd+Shift+X` - Strikethrough
- `Ctrl+K` / `Cmd+K` - Link
- ``Ctrl+` `` / ``Cmd+` `` - Inline code
- `Ctrl+S` / `Cmd+S` - Save

### MarkdownPreview

A react-markdown-based preview component that renders markdown with GitHub Flavored Markdown support.

**Features:**
- GitHub Flavored Markdown (tables, strikethrough, task lists)
- Custom styled components (headings, lists, code blocks, tables)
- Dark mode support
- Links disabled in preview mode (with visual indication)

**Usage:**
```tsx
import { MarkdownPreview } from '@/components/editor';

<MarkdownPreview content="# Hello World" />
```

**Props:**
- `content: string` - Markdown content to render
- `className?: string` - Additional CSS classes

### EditorPane

A split-pane layout component that combines MarkdownEditor, MarkdownToolbar, and MarkdownPreview with autosave and unsaved changes detection.

**Features:**
- Three view modes: split, edit-only, preview-only
- Resizable divider (20%-80% range)
- Real-time preview synchronization
- Markdown formatting toolbar
- Autosave with debouncing (5 seconds default)
- Save status indicator (Saving..., Saved timestamp, Unsaved changes)
- Unsaved changes warning on navigation
- View mode toggle buttons

**Usage:**
```tsx
import { EditorPane } from '@/components/editor';

<EditorPane
  initialContent="# Hello World"
  onContentChange={(content) => console.log(content)}
  onSave={async () => {
    await saveToBackend(content);
  }}
  editable={true}
  showPreview={true}
  enableAutosave={true}
  autosaveDelay={5000}
/>
```

**Props:**
- `initialContent?: string` - Initial content for the editor
- `onContentChange?: (content: string) => void` - Callback when content changes
- `onSave?: () => Promise<void> | void` - Callback when save is triggered (manual or auto)
- `editable?: boolean` - Whether the editor is editable (default: true)
- `showPreview?: boolean` - Whether to show preview pane initially (default: true)
- `enableAutosave?: boolean` - Enable autosave functionality (default: true)
- `autosaveDelay?: number` - Autosave delay in milliseconds (default: 5000)

## Hooks

### useAutosave

Custom hook for implementing autosave with debouncing.

**Features:**
- Debounced save with configurable delay
- Tracks save state (saving, last saved timestamp, errors)
- Tracks dirty state (unsaved changes)
- Manual save trigger
- Error handling

**Usage:**
```tsx
import { useAutosave } from '@/hooks';

const { isSaving, lastSaved, isDirty, triggerSave } = useAutosave(content, {
  onSave: async () => await saveContent(),
  delay: 5000,
  enabled: true,
});
```

### useUnsavedChanges

Custom hook to warn users about unsaved changes when navigating away.

**Features:**
- Browser navigation warning (close tab, refresh, back/forward)
- React Router navigation warning (internal links)
- Configurable warning message
- Enable/disable warning

**Usage:**
```tsx
import { useUnsavedChanges } from '@/hooks';

useUnsavedChanges({
  isDirty: hasUnsavedChanges,
  message: 'You have unsaved changes. Are you sure you want to leave?',
  enabled: true,
});
```

## Implementation Notes

### Task 5.3 Completion (Week 5: Page Editor - Editor Features)

This implementation completes task 5.3 from the BlueFinWiki implementation plan:

✅ **Built Markdown toolbar:**
- Formatting buttons: Bold, Italic, Strikethrough
- Headers dropdown: H1-H6
- List buttons: Unordered, ordered, task lists
- Link and image insertion
- Code: Inline code and code blocks
- Keyboard shortcuts: Ctrl+B, Ctrl+I, Ctrl+Shift+X, Ctrl+K, Ctrl+`

✅ **Implemented autosave mechanism:**
- Debounced save (5 seconds after last edit, configurable)
- "Saving..." indicator during save operation
- Last saved timestamp display (e.g., "Saved 2m ago")
- Error handling with error state tracking
- Manual save trigger via Ctrl+S

✅ **Added unsaved changes warning:**
- Dirty state detection based on content changes
- Browser navigation warning (beforeunload event)
- React Router navigation warning (click event interception)
- Customizable warning message
- Enable/disable warning per component

### Architecture

**Component Structure:**
- `MarkdownToolbar` - UI layer for formatting actions
- `MarkdownEditor` - CodeMirror integration with toolbar action support
- `EditorPane` - Orchestration layer combining toolbar, editor, preview
- `useAutosave` - Logic layer for autosave with debouncing
- `useUnsavedChanges` - Logic layer for navigation warnings

**Data Flow:**
1. User types in editor → content changes
2. Content change triggers `onChange` callback
3. Autosave hook detects change and marks as dirty
4. After delay (5s), autosave triggers `onSave` callback
5. Save status updates (saving → saved with timestamp)
6. Dirty state clears on successful save

**Keyboard Shortcuts:**
- Integrated into CodeMirror keymap for immediate response
- Actions applied via ref method to editor
- Prevents default browser behavior (e.g., Ctrl+S)

### Testing Recommendations

Test coverage should include:
- [ ] Toolbar button clicks apply correct formatting
- [ ] Keyboard shortcuts work in editor
- [ ] Autosave triggers after delay
- [ ] Manual save (Ctrl+S) triggers immediately
- [ ] Save status indicator updates correctly
- [ ] Unsaved changes warning appears on navigation
- [ ] Warning does not appear when no changes
- [ ] Error handling for failed saves

### Future Enhancements

Potential improvements for future iterations:
- Undo/redo for toolbar actions
- Custom toolbar button configuration
- Toolbar button active state (e.g., bold button highlighted when cursor in bold text)
- Conflict resolution for concurrent edits
- Offline save queue with retry
- Save history/versioning integration

This implementation completes task 5.1 from the BlueFinWiki implementation plan:

✅ **Installed CodeMirror 6 dependencies:**
- @codemirror/state
- @codemirror/view
- @codemirror/lang-markdown
- @codemirror/commands

✅ **Configured Markdown language mode:**
- Syntax highlighting via @codemirror/lang-markdown
- Auto-indentation and bracket matching (built-in)
- Active line highlighting

✅ **Set up split-pane layout:**
- Resizable divider with mouse drag support
- Three view modes (split, edit-only, preview-only)
- Synchronized content between editor and preview
- Toggle buttons for view mode switching

### Architecture Decisions

1. **CodeMirror 6**: Chosen for its modern architecture, extensibility, and TypeScript support
2. **react-markdown**: Used for preview rendering to ensure consistency with page view
3. **Resizable divider**: Custom implementation using mouse events for precise control
4. **View modes**: Three modes provide flexibility for different user preferences

### Next Steps (Task 5.2-5.5)

- [ ] Task 5.2: Enhance MarkdownPreview with remark plugins for better GFM support
- [ ] Task 5.3: Add markdown toolbar with formatting buttons
- [ ] Task 5.4: Create page metadata editing panel
- [ ] Task 5.5: Integrate with backend APIs (load, save, conflict handling)

## Dependencies

- `@codemirror/state` - CodeMirror state management
- `@codemirror/view` - CodeMirror view layer
- `@codemirror/lang-markdown` - Markdown language support
- `@codemirror/commands` - Editor commands (undo/redo, etc.)
- `react-markdown` - Markdown to React rendering
- `remark-gfm` - GitHub Flavored Markdown plugin

## Testing

Testing will be added in subsequent tasks. Test files should be placed in:
- `__tests__/MarkdownEditor.test.tsx`
- `__tests__/MarkdownPreview.test.tsx`
- `__tests__/EditorPane.test.tsx`

Key test scenarios:
- Content changes trigger onChange callback
- Save shortcut triggers onSave callback
- View mode switching works correctly
- Divider resizing works within constraints
- Preview renders markdown correctly
- Links are disabled in preview mode
