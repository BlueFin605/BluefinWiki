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
- Auto-indentation and bracket matching
- Editable/read-only mode support

**Usage:**
```tsx
import { MarkdownEditor } from '@/components/editor';

<MarkdownEditor
  initialValue="# Hello World"
  onChange={(content) => console.log(content)}
  onSave={() => console.log('Saved!')}
  editable={true}
/>
```

**Props:**
- `initialValue?: string` - Initial content for the editor
- `onChange?: (value: string) => void` - Callback when content changes
- `onSave?: () => void` - Callback when Ctrl+S is pressed
- `editable?: boolean` - Whether the editor is editable (default: true)

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

A split-pane layout component that combines MarkdownEditor and MarkdownPreview with a resizable divider.

**Features:**
- Three view modes: split, edit-only, preview-only
- Resizable divider (20%-80% range)
- Real-time preview synchronization
- View mode toggle buttons

**Usage:**
```tsx
import { EditorPane } from '@/components/editor';

<EditorPane
  initialContent="# Hello World"
  onContentChange={(content) => console.log(content)}
  onSave={() => console.log('Saved!')}
  editable={true}
  showPreview={true}
/>
```

**Props:**
- `initialContent?: string` - Initial content for the editor
- `onContentChange?: (content: string) => void` - Callback when content changes
- `onSave?: () => void` - Callback when save is triggered
- `editable?: boolean` - Whether the editor is editable (default: true)
- `showPreview?: boolean` - Whether to show preview pane initially (default: true)

## Implementation Notes

### Task 5.1 Completion (Week 5: Page Editor)

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
