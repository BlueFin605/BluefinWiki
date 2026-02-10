# Page Tree Components

This directory contains all the frontend components for the hierarchical page tree functionality in BlueFinWiki.

## Components

### PageTree
The main component that manages the page tree state and orchestrates all child components.

**Features:**
- Fetches and displays root-level pages
- Manages expand/collapse state
- Handles drag-and-drop operations
- Integrates with context menu and modals

**Usage:**
```tsx
<PageTree
  activePageGuid={selectedGuid}
  onPageSelect={(guid) => console.log('Selected:', guid)}
  onContextMenu={(event, page) => showContextMenu(event, page)}
/>
```

### PageTreeItem
Recursive component that renders individual page nodes in the tree.

**Features:**
- Displays page title with icon (folder or document)
- Shows expand/collapse arrow for pages with children
- Highlights active page
- Supports keyboard navigation
- Draggable for moving pages
- Drop target for accepting moved pages
- Status badges for draft/archived pages

**Props:**
- `page`: PageTreeNode - The page to render
- `level`: number - Indentation level
- `isActive`: boolean - Whether this is the active page
- `onSelect`: (guid) => void - Called when page is clicked
- `onContextMenu`: (event, page) => void - Called on right-click
- `onDragStart`: (event, page) => void - Called when drag starts
- `onDragOver`: (event, page) => void - Called when dragging over
- `onDrop`: (event, page) => void - Called when dropped
- `onToggleExpand`: (guid) => void - Called to expand/collapse

### PageContextMenu
Right-click context menu for page operations.

**Features:**
- Rename page
- Delete page (with confirmation)
- Move page
- Create child page
- Keyboard shortcuts displayed
- Closes on click outside or Escape

**Props:**
- `page`: PageTreeNode | null - The page to operate on
- `position`: { x, y } - Screen coordinates for menu
- `onClose`: () => void - Called to close menu
- `onRename`: (page) => void - Called to start rename
- `onDelete`: (page) => void - Called to delete page
- `onMove`: (page) => void - Called to move page
- `onNewChild`: (page) => void - Called to create child

### NewPageModal
Modal dialog for creating new pages.

**Features:**
- Title input with validation (3-100 characters)
- Optional description field
- Checkbox to create as root page
- Parent page selection dropdown
- Form validation and error display
- Loading state during creation

**Props:**
- `isOpen`: boolean - Whether modal is visible
- `onClose`: () => void - Called to close modal
- `defaultParentGuid`: string | null - Default parent page

### PageRenameInline
Inline text editor for renaming pages.

**Features:**
- Auto-focus and select text on mount
- Save on Enter or blur
- Cancel on Escape
- Validates title (3-100 characters)
- Shows error messages
- Loading state during save

**Props:**
- `page`: PageTreeNode - The page being renamed
- `onComplete`: () => void - Called after successful rename
- `onCancel`: () => void - Called to cancel editing

### PagesView
Complete page management interface that integrates all components.

**Features:**
- Sidebar with page tree
- Main content area for viewing pages
- Context menu integration
- New page modal
- Delete confirmation dialog
- Rename inline editor
- Create new root page button

## Data Types

### PageTreeNode
```typescript
interface PageTreeNode extends PageSummary {
  children?: PageTreeNode[];
  isExpanded?: boolean;
}
```

### PageSummary
```typescript
interface PageSummary {
  guid: string;
  title: string;
  parentGuid: string | null;
  status: 'draft' | 'published' | 'archived';
  modifiedAt: string;
  modifiedBy: string;
  hasChildren: boolean;
}
```

## API Hooks

All components use React Query hooks from `hooks/usePages.ts`:

- `usePageChildren(parentGuid)` - Fetch children of a page
- `usePageDetail(guid)` - Fetch full page content
- `useCreatePage()` - Create a new page
- `useUpdatePage(guid)` - Update page metadata/content
- `useMovePage(guid)` - Move page to new parent
- `useDeletePage()` - Delete page (optionally recursive)

## Keyboard Shortcuts

- **Enter** - Open selected page
- **Arrow Right** - Expand page (if has children)
- **Arrow Left** - Collapse page (if expanded)
- **F2** - Rename page (from context menu)
- **Ctrl+N** - New child page (from context menu)
- **Ctrl+M** - Move page (from context menu)
- **Delete** - Delete page (from context menu)
- **Escape** - Close modal/menu/cancel operation

## Drag and Drop

Pages can be moved by dragging them to a new parent:

1. Click and drag a page
2. Hover over the target parent page
3. Drop to move the page
4. The tree refreshes automatically

**Validation:**
- Cannot drop a page on itself
- Backend prevents circular references
- Visual feedback shows valid drop targets

## Styling

All components use Tailwind CSS utility classes:
- Responsive design
- Hover states
- Focus indicators for accessibility
- Animations for expand/collapse
- Status badges with color coding

## Integration Example

```tsx
import { PagesView } from './components/pages/PagesView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PagesView />
    </QueryClientProvider>
  );
}
```

## Future Enhancements

- [ ] Multi-select for batch operations
- [ ] Copy/paste pages
- [ ] Duplicate page
- [ ] Page templates
- [ ] Advanced search in tree
- [ ] Custom page icons
- [ ] Color coding for folders
- [ ] Breadcrumb navigation
- [ ] Recent pages list
- [ ] Favorites/bookmarks
