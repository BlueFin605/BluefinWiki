import React, { useState, useRef, useCallback } from 'react';
import MarkdownEditor, { MarkdownEditorRef } from './MarkdownEditor';
import MarkdownPreview from './MarkdownPreview';
import MarkdownToolbar, { ToolbarAction } from './MarkdownToolbar';
import PagePropertiesPanel, { PageMetadata } from './PagePropertiesPanel';
import { useAutosave } from '../../hooks/useAutosave';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

interface EditorPaneProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onSave?: () => Promise<void> | void;
  editable?: boolean;
  showPreview?: boolean;
  /** Enable autosave (default: true) */
  enableAutosave?: boolean;
  /** Autosave delay in milliseconds (default: 5000) */
  autosaveDelay?: number;
  /** Page metadata for properties panel */
  metadata?: PageMetadata;
  /** Callback when metadata changes */
  onMetadataChange?: (metadata: Partial<PageMetadata>) => void;
  /** Show properties panel (default: false) */
  showPropertiesPanel?: boolean;
}

type ViewMode = 'split' | 'edit' | 'preview';

/**
 * Split-pane editor with markdown editing on left and live preview on right
 * Features:
 * - Markdown toolbar with formatting buttons
 * - Resizable divider between editor and preview
 * - Toggle between split, edit-only, and preview-only modes
 * - Synchronized content between editor and preview
 * - Autosave with debouncing
 * - Unsaved changes warning
 */
export const EditorPane: React.FC<EditorPaneProps> = ({
  initialContent = '',
  onContentChange,
  onSave,
  editable = true,
  showPreview = true,
  enableAutosave = true,
  autosaveDelay = 5000,
  metadata,
  onMetadataChange,
  showPropertiesPanel = false,
}) => {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>(showPreview ? 'split' : 'edit');
  const [dividerPosition, setDividerPosition] = useState(50); // percentage
  const [showProperties, setShowProperties] = useState(showPropertiesPanel);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
  }, [onContentChange]);

  // Autosave hook
  const { isSaving, lastSaved, isDirty, triggerSave } = useAutosave(content, {
    onSave: async () => {
      if (onSave) {
        await onSave();
      }
    },
    delay: autosaveDelay,
    enabled: enableAutosave && editable,
  });

  // Unsaved changes warning
  useUnsavedChanges({
    isDirty,
    enabled: enableAutosave && editable,
  });

  // Handle toolbar action
  const handleToolbarAction = useCallback((action: ToolbarAction) => {
    if (editorRef.current) {
      editorRef.current.applyToolbarAction(action);
    }
  }, []);

  // Handle manual save (e.g., Ctrl+S)
  const handleManualSave = useCallback(() => {
    triggerSave();
  }, [triggerSave]);

  // Handle divider drag
  const handleMouseDown = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain between 20% and 80%
    const clampedPosition = Math.min(Math.max(newPosition, 20), 80);
    setDividerPosition(clampedPosition);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Add and remove mouse event listeners
  React.useEffect(() => {
    if (viewMode !== 'split') return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [viewMode, handleMouseMove, handleMouseUp]);

  const renderViewModeButtons = () => (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded">
      <button
        onClick={() => setViewMode('edit')}
        className={`px-3 py-1 text-sm rounded ${
          viewMode === 'edit'
            ? 'bg-white dark:bg-gray-700 shadow'
            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        title="Edit only"
        aria-label="Edit only mode"
      >
        Edit
      </button>
      <button
        onClick={() => setViewMode('split')}
        className={`px-3 py-1 text-sm rounded ${
          viewMode === 'split'
            ? 'bg-white dark:bg-gray-700 shadow'
            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        title="Split view"
        aria-label="Split view mode"
      >
        Split
      </button>
      <button
        onClick={() => setViewMode('preview')}
        className={`px-3 py-1 text-sm rounded ${
          viewMode === 'preview'
            ? 'bg-white dark:bg-gray-700 shadow'
            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        title="Preview only"
        aria-label="Preview only mode"
      >
        Preview
      </button>
    </div>
  );

  const renderSaveStatus = () => {
    if (!enableAutosave || !editable) return null;

    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {isSaving && (
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Saving...
          </span>
        )}
        {!isSaving && isDirty && (
          <span>Unsaved changes</span>
        )}
        {!isSaving && !isDirty && lastSaved && (
          <span>
            Saved {formatTimestamp(lastSaved)}
          </span>
        )}
      </div>
    );
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full">
      {/* Properties Panel Sidebar (optional) */}
      {showProperties && metadata && (
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <PagePropertiesPanel
            metadata={metadata}
            onMetadataChange={onMetadataChange || (() => {})}
            editable={editable}
            onTitleChange={(newTitle) => {
              // Update H1 in content if present
              const lines = content.split('\n');
              if (lines[0]?.startsWith('# ')) {
                const updatedContent = [`# ${newTitle}`, ...lines.slice(1)].join('\n');
                setContent(updatedContent);
                if (onContentChange) {
                  onContentChange(updatedContent);
                }
              }
              onMetadataChange?.({ title: newTitle });
            }}
          />
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Top toolbar with view mode toggle and save status */}
        <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {renderSaveStatus()}
            {metadata && (
              <button
                onClick={() => setShowProperties(!showProperties)}
                className="px-3 py-1 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title={showProperties ? 'Hide properties' : 'Show properties'}
                aria-label={showProperties ? 'Hide properties panel' : 'Show properties panel'}
              >
                {showProperties ? '◀ Hide' : '▶ Properties'}
              </button>
            )}
          </div>
          {renderViewModeButtons()}
        </div>

        {/* Markdown formatting toolbar */}
        {editable && (viewMode === 'edit' || viewMode === 'split') && (
          <MarkdownToolbar onAction={handleToolbarAction} disabled={!editable} />
        )}

        {/* Editor and/or preview panes */}
        <div ref={containerRef} className="flex-1 flex overflow-hidden">
          {/* Editor pane */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div
              className="overflow-hidden"
              style={{
                width: viewMode === 'split' ? `${dividerPosition}%` : '100%',
              }}
            >
              <MarkdownEditor
                ref={editorRef}
                initialValue={content}
                onChange={handleContentChange}
                onSave={handleManualSave}
                editable={editable}
              />
            </div>
          )}

          {/* Resizable divider */}
          {viewMode === 'split' && (
            <div
              className="w-1 bg-gray-300 dark:bg-gray-600 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors"
              onMouseDown={handleMouseDown}
              role="separator"
              aria-label="Resize editor and preview"
            />
          )}

          {/* Preview pane */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div
              className="overflow-hidden"
              style={{
                width: viewMode === 'split' ? `${100 - dividerPosition}%` : '100%',
              }}
            >
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorPane;
