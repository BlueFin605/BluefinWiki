# PagePropertiesPanel - Quick Start Guide

## Basic Usage

### Standalone Usage
```tsx
import { PagePropertiesPanel, PageMetadata } from '@/components/editor';

const MyComponent = () => {
  const metadata: PageMetadata = {
    title: 'Getting Started Guide',
    tags: ['tutorial', 'beginner'],
    status: 'published',
    createdBy: 'user-123',
    modifiedBy: 'user-456',
    createdAt: '2026-02-01T10:00:00Z',
    modifiedAt: '2026-02-14T14:30:00Z',
  };

  const handleMetadataChange = (changes: Partial<PageMetadata>) => {
    console.log('Metadata changed:', changes);
    // Update your state or call API
  };

  return (
    <PagePropertiesPanel
      metadata={metadata}
      onMetadataChange={handleMetadataChange}
      editable={true}
    />
  );
};
```

### Integrated with EditorPane
```tsx
import { EditorPane, PageMetadata } from '@/components/editor';
import { useState } from 'react';

const PageEditor = () => {
  const [content, setContent] = useState('# My Page\n\nContent goes here...');
  const [metadata, setMetadata] = useState<PageMetadata>({
    title: 'My Page',
    tags: ['project', 'documentation'],
    status: 'draft',
    createdBy: 'user-123',
    modifiedBy: 'user-123',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  });

  const handleSave = async () => {
    // Save to backend
    await fetch('/api/pages/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        title: metadata.title,
        tags: metadata.tags,
        status: metadata.status,
      }),
    });
  };

  const handleMetadataChange = (changes: Partial<PageMetadata>) => {
    setMetadata(prev => ({
      ...prev,
      ...changes,
      modifiedAt: new Date().toISOString(),
    }));
  };

  return (
    <div className="h-screen">
      <EditorPane
        initialContent={content}
        onContentChange={setContent}
        onSave={handleSave}
        metadata={metadata}
        onMetadataChange={handleMetadataChange}
        showPropertiesPanel={true}
        editable={true}
        enableAutosave={true}
        autosaveDelay={5000}
      />
    </div>
  );
};

export default PageEditor;
```

## Props Reference

### PagePropertiesPanel

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `metadata` | `PageMetadata` | Yes | Current page metadata |
| `onMetadataChange` | `(changes: Partial<PageMetadata>) => void` | Yes | Callback when metadata changes |
| `editable` | `boolean` | No | Whether fields are editable (default: true) |
| `onTitleChange` | `(title: string) => void` | No | Additional callback for title changes |

### PageMetadata Interface

```typescript
interface PageMetadata {
  title: string;                              // Page title
  tags: string[];                             // Array of tag strings
  status: 'draft' | 'published' | 'archived'; // Publication status
  description?: string;                       // Optional description
  createdBy: string;                          // User ID of creator
  modifiedBy: string;                         // User ID of last modifier
  createdAt: string;                          // ISO 8601 timestamp
  modifiedAt: string;                         // ISO 8601 timestamp
}
```

### EditorPane (Enhanced)

New props for metadata support:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `metadata` | `PageMetadata` | No | Page metadata for properties panel |
| `onMetadataChange` | `(changes: Partial<PageMetadata>) => void` | No | Callback when metadata changes |
| `showPropertiesPanel` | `boolean` | No | Show properties panel initially (default: false) |

## Features in Detail

### Title Editing
- Click title field to edit
- Press Enter to save
- Press Escape to cancel
- Blur automatically saves

### Tag Management
- Type tag name
- Press Enter or comma to add
- Click × to remove
- Backspace on empty input removes last tag
- Tags automatically lowercased
- Duplicates prevented

### Status Selection
- **Draft**: Yellow badge - "Only you and admins can see this page"
- **Published**: Green badge - Default visible state
- **Archived**: Gray badge - "Read-only, excluded from main navigation"

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between fields |
| Enter | Save title / Add tag |
| Escape | Cancel title edit |
| Comma | Add tag (when typing) |
| Backspace | Remove last tag (when input empty) |

## Styling

The component uses Tailwind CSS classes and supports:
- Light mode
- Dark mode (automatic based on theme)
- Responsive design
- Accessible focus indicators

### Custom Styling

You can wrap the component in a container with custom classes:

```tsx
<div className="p-4 bg-gray-100 dark:bg-gray-900">
  <PagePropertiesPanel
    metadata={metadata}
    onMetadataChange={handleChange}
  />
</div>
```

## Integration with Backend

### Saving Metadata

```typescript
const handleMetadataChange = async (changes: Partial<PageMetadata>) => {
  // Update local state
  setMetadata(prev => ({ ...prev, ...changes }));

  // Optionally save immediately
  try {
    await fetch(`/api/pages/${pageId}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
  } catch (error) {
    console.error('Failed to save metadata:', error);
  }
};
```

### Loading Metadata

```typescript
useEffect(() => {
  const loadPage = async () => {
    const response = await fetch(`/api/pages/${pageId}`);
    const page = await response.json();
    
    setContent(page.content);
    setMetadata({
      title: page.title,
      tags: page.tags || [],
      status: page.status,
      createdBy: page.createdBy,
      modifiedBy: page.modifiedBy,
      createdAt: page.createdAt,
      modifiedAt: page.modifiedAt,
    });
  };

  loadPage();
}, [pageId]);
```

## Examples

### Read-Only Mode

```tsx
<PagePropertiesPanel
  metadata={metadata}
  onMetadataChange={() => {}}
  editable={false}
/>
```

### With Title Sync

```tsx
<PagePropertiesPanel
  metadata={metadata}
  onMetadataChange={handleMetadataChange}
  onTitleChange={(newTitle) => {
    // Sync with H1 in content
    const lines = content.split('\n');
    if (lines[0]?.startsWith('# ')) {
      const updatedContent = [`# ${newTitle}`, ...lines.slice(1)].join('\n');
      setContent(updatedContent);
    }
  }}
/>
```

## Troubleshooting

### Tags not updating
Ensure `onMetadataChange` is properly handling the tags array:
```typescript
const handleMetadataChange = (changes: Partial<PageMetadata>) => {
  setMetadata(prev => ({ ...prev, ...changes }));
};
```

### Title not syncing with H1
Make sure your content has an H1 header and use the `onTitleChange` callback:
```typescript
onTitleChange={(newTitle) => {
  const updatedContent = content.replace(/^# .*$/m, `# ${newTitle}`);
  setContent(updatedContent);
}}
```

### Dark mode not working
Ensure your app has dark mode configured in Tailwind:
```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // or 'media'
  // ...
};
```

## Best Practices

1. **Always provide all metadata fields** - Even if some are optional, provide defaults
2. **Handle errors gracefully** - Wrap API calls in try-catch blocks
3. **Update modifiedAt on changes** - Keep timestamps accurate
4. **Validate tag limits** - Consider limiting number of tags (e.g., max 20)
5. **Persist changes** - Either on every change or with debouncing
6. **Show loading states** - Indicate when metadata is being saved

## Related Components

- `EditorPane` - Main editor component with split view
- `MarkdownEditor` - CodeMirror-based markdown editor
- `MarkdownToolbar` - Formatting toolbar
- `MarkdownPreview` - Live preview pane

## Further Reading

- [Task 5.4 Implementation](./TASK-5.4-IMPLEMENTATION.md) - Detailed implementation notes
- [Page Metadata Specification](./16-page-metadata.md) - Full feature spec
- [Editor Components README](./frontend/src/components/editor/README.md) - Editor documentation
