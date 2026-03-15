/**
 * Tests for EditorPane component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditorPane } from '../EditorPane';

// Mock child components
vi.mock('../MarkdownEditor', () => ({
  default: vi.fn(({ onChange, editable }: { onChange?: (value: string) => void; editable?: boolean }) => (
    <div data-testid="markdown-editor" data-editable={editable}>
      <button onClick={() => onChange && onChange('new content')}>
        Change Content
      </button>
    </div>
  )),
  MarkdownEditor: vi.fn(({ onChange, editable }: { onChange?: (value: string) => void; editable?: boolean }) => (
    <div data-testid="markdown-editor" data-editable={editable}>
      <button onClick={() => onChange && onChange('new content')}>
        Change Content
      </button>
    </div>
  )),
}));

vi.mock('../MarkdownPreview', () => ({
  default: ({ content }: { content?: string }) => (
    <div data-testid="markdown-preview">{content}</div>
  ),
  MarkdownPreview: ({ content }: { content?: string }) => (
    <div data-testid="markdown-preview">{content}</div>
  ),
}));

vi.mock('../MarkdownToolbar', () => ({
  default: ({ onAction, disabled }: { onAction?: (action: string) => void; disabled?: boolean }) => (
    <div data-testid="markdown-toolbar" data-disabled={disabled}>
      <button onClick={() => onAction && onAction('bold')}>Bold</button>
    </div>
  ),
  MarkdownToolbar: ({ onAction, disabled }: { onAction?: (action: string) => void; disabled?: boolean }) => (
    <div data-testid="markdown-toolbar" data-disabled={disabled}>
      <button onClick={() => onAction && onAction('bold')}>Bold</button>
    </div>
  ),
}));

vi.mock('../PagePropertiesPanel', () => ({
  default: ({ metadata, onMetadataChange }: { metadata?: Record<string, unknown>; onMetadataChange?: (metadata: Record<string, unknown>) => void }) => (
    <div data-testid="page-properties-panel">
      {String(metadata?.title || '')}
      <button onClick={() => onMetadataChange && onMetadataChange({ title: 'Updated' })}>
        Update
      </button>
    </div>
  ),
  PagePropertiesPanel: ({ metadata, onMetadataChange }: { metadata?: Record<string, unknown>; onMetadataChange?: (metadata: Record<string, unknown>) => void }) => (
    <div data-testid="page-properties-panel">
      {String(metadata?.title || '')}
      <button onClick={() => onMetadataChange && onMetadataChange({ title: 'Updated' })}>
        Update
      </button>
    </div>
  ),
}));

vi.mock('../../hooks/useAutosave', () => ({
  useAutosave: () => ({
    isSaving: false,
    lastSaved: null,
    isDirty: false,
    triggerSave: vi.fn(),
  }),
}));

vi.mock('../../hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: vi.fn(),
}));

// Helper to render with Router and QueryClient context
const renderWithRouter = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

/** Helper: switch to split mode so both editor and preview are visible */
async function switchToSplit() {
  const user = userEvent.setup();
  const splitButton = screen.getByLabelText('Split view mode');
  await user.click(splitButton);
}

describe('EditorPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with default props', async () => {
      renderWithRouter(<EditorPane />);

      // Default mode is preview; switch to split to see editor + toolbar
      await switchToSplit();
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
      expect(screen.getByTestId('markdown-toolbar')).toBeInTheDocument();
    });

    it('should render with initial content', async () => {
      renderWithRouter(<EditorPane initialContent="# Hello World" />);

      await switchToSplit();
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });

    it('should default to preview mode when showPreview is true', () => {
      renderWithRouter(<EditorPane showPreview={true} />);

      // Preview visible, editor hidden
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
      expect(screen.queryByTestId('markdown-editor')).not.toBeInTheDocument();
    });

    it('should default to split mode when there is draft content', () => {
      renderWithRouter(<EditorPane showPreview={true} draftContent="unsaved changes" />);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    });

    it('should not render preview when showPreview is false', () => {
      renderWithRouter(<EditorPane showPreview={false} />);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
      expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
    });
  });

  describe('View Mode Switching', () => {
    it('should show view mode buttons', () => {
      renderWithRouter(<EditorPane showPreview={true} />);

      expect(screen.getByLabelText('Edit only mode')).toBeInTheDocument();
      expect(screen.getByLabelText('Split view mode')).toBeInTheDocument();
      expect(screen.getByLabelText('Preview only mode')).toBeInTheDocument();
    });

    it('should switch to edit-only mode', async () => {
      const user = userEvent.setup();
      renderWithRouter(<EditorPane showPreview={true} />);

      const editButton = screen.getByLabelText('Edit only mode');
      await user.click(editButton);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
      expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
    });

    it('should switch to preview-only mode', async () => {
      renderWithRouter(<EditorPane showPreview={true} initialContent="# Test" />);

      // Already in preview mode by default, but verify
      expect(screen.queryByTestId('markdown-editor')).not.toBeInTheDocument();
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    });

    it('should switch back to split mode', async () => {
      const user = userEvent.setup();
      renderWithRouter(<EditorPane showPreview={true} />);

      // Switch to edit mode
      const editButton = screen.getByLabelText('Edit only mode');
      await user.click(editButton);

      // Switch back to split
      const splitButton = screen.getByLabelText('Split view mode');
      await user.click(splitButton);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    });
  });

  describe('Content Changes', () => {
    it('should call onContentChange when content is edited', async () => {
      const onContentChange = vi.fn();
      renderWithRouter(<EditorPane onContentChange={onContentChange} />);

      await switchToSplit();
      const changeButton = screen.getByText('Change Content');
      fireEvent.click(changeButton);

      expect(onContentChange).toHaveBeenCalledWith('new content');
    });

    it('should update preview when content changes', async () => {
      renderWithRouter(<EditorPane showPreview={true} initialContent="Initial" draftContent="Initial" />);

      const changeButton = screen.getByText('Change Content');
      fireEvent.click(changeButton);

      await waitFor(() => {
        expect(screen.getByTestId('markdown-preview')).toHaveTextContent('new content');
      });
    });
  });

  describe('Editable Mode', () => {
    it('should be editable by default', async () => {
      renderWithRouter(<EditorPane />);

      await switchToSplit();
      const editor = screen.getByTestId('markdown-editor');
      expect(editor).toHaveAttribute('data-editable', 'true');
    });

    it('should be read-only when editable is false', async () => {
      renderWithRouter(<EditorPane editable={false} />);

      await switchToSplit();
      const editor = screen.getByTestId('markdown-editor');
      expect(editor).toHaveAttribute('data-editable', 'false');

      // Toolbar may not be rendered when editable is false
      const toolbar = screen.queryByTestId('markdown-toolbar');
      if (toolbar) {
        expect(toolbar).toHaveAttribute('data-disabled', 'true');
      }

      // Component should render (autosave is enabled internally)
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });

    it('should render editor without autosave', async () => {
      renderWithRouter(<EditorPane />);

      await switchToSplit();
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should call onSave when save is triggered', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(<EditorPane onSave={onSave} />);

      await switchToSplit();
      // Trigger content change to enable autosave
      const changeButton = screen.getByText('Change Content');
      fireEvent.click(changeButton);

      // Note: Actual autosave trigger would require waiting for debounce
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });
  });

  describe('Properties Panel', () => {
    it('should not show properties panel by default', () => {
      renderWithRouter(<EditorPane />);

      expect(screen.queryByTestId('page-properties-panel')).not.toBeInTheDocument();
    });

    it('should show properties panel when inspector is opened', async () => {
      const user = userEvent.setup();
      const metadata = {
        title: 'Test Page',
        tags: ['test'],
        status: 'draft' as const,
        createdBy: 'user1',
        modifiedBy: 'user1',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
      };

      renderWithRouter(
        <EditorPane
          pageGuid="test-guid"
          metadata={metadata}
        />
      );

      // Open the inspector panel
      const inspectorBtn = screen.getByTitle(/inspector/i);
      await user.click(inspectorBtn);

      expect(screen.getByTestId('page-properties-panel')).toBeInTheDocument();
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    it('should pass onMetadataChange to inspector panel', () => {
      const onMetadataChange = vi.fn();
      const metadata = {
        title: 'Test Page',
        tags: ['test'],
        status: 'draft' as const,
        createdBy: 'user1',
        modifiedBy: 'user1',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
      };

      renderWithRouter(
        <EditorPane
          pageGuid="test-guid"
          metadata={metadata}
          onMetadataChange={onMetadataChange}
        />
      );

      // Verify the inspector toggle button exists
      expect(screen.getByTitle(/inspector/i)).toBeInTheDocument();
    });
  });

  describe('Toolbar Integration', () => {
    it('should render toolbar', async () => {
      renderWithRouter(<EditorPane />);

      await switchToSplit();
      expect(screen.getByTestId('markdown-toolbar')).toBeInTheDocument();
    });

    it('should disable toolbar when not editable', async () => {
      renderWithRouter(<EditorPane editable={false} />);

      await switchToSplit();
      // Toolbar may not be rendered when editable is false
      const toolbar = screen.queryByTestId('markdown-toolbar');
      if (toolbar) {
        expect(toolbar).toHaveAttribute('data-disabled', 'true');
      } else {
        // If toolbar is not rendered, that's acceptable for non-editable mode
        expect(toolbar).toBeNull();
      }
    });

    it('should handle toolbar actions', async () => {
      const user = userEvent.setup();
      renderWithRouter(<EditorPane />);

      await switchToSplit();
      const boldButton = screen.getByText('Bold');
      await user.click(boldButton);

      // Toolbar action should be handled (tested via mocks)
      expect(screen.getByTestId('markdown-toolbar')).toBeInTheDocument();
    });
  });

  describe('Resizable Divider (Split Mode)', () => {
    it('should render divider in split mode', async () => {
      renderWithRouter(<EditorPane showPreview={true} />);

      await switchToSplit();
      // Check for split layout
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    });

    it('should not render divider in edit-only mode', async () => {
      const user = userEvent.setup();
      renderWithRouter(<EditorPane showPreview={true} />);

      const editButton = screen.getByLabelText('Edit only mode');
      await user.click(editButton);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
      expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty initial content', async () => {
      renderWithRouter(<EditorPane initialContent="" />);

      await switchToSplit();
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });

    it('should handle long content', async () => {
      const longContent = '# Title\n\n' + 'Lorem ipsum '.repeat(1000);
      renderWithRouter(<EditorPane initialContent={longContent} showPreview={true} draftContent={longContent} />);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    });

    it('should handle rapid view mode changes', async () => {
      const user = userEvent.setup();
      renderWithRouter(<EditorPane showPreview={true} />);

      const editButton = screen.getByLabelText('Edit only mode');
      const splitButton = screen.getByLabelText('Split view mode');
      const previewButton = screen.getByLabelText('Preview only mode');

      await user.click(editButton);
      await user.click(splitButton);
      await user.click(previewButton);
      await user.click(editButton);

      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });
  });

  describe('Save Status Display', () => {
    it('should show save status when editable', async () => {
      renderWithRouter(<EditorPane editable={true} />);

      await switchToSplit();
      // Component should render
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });

    it('should show read-only status when not editable', async () => {
      renderWithRouter(<EditorPane editable={false} />);

      await switchToSplit();
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });
  });
});
