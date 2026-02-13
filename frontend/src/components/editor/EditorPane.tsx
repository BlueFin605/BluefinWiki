import React, { useState, useRef, useCallback } from 'react';
import MarkdownEditor from './MarkdownEditor';
import MarkdownPreview from './MarkdownPreview';

interface EditorPaneProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  editable?: boolean;
  showPreview?: boolean;
}

type ViewMode = 'split' | 'edit' | 'preview';

/**
 * Split-pane editor with markdown editing on left and live preview on right
 * Features:
 * - Resizable divider between editor and preview
 * - Toggle between split, edit-only, and preview-only modes
 * - Synchronized content between editor and preview
 */
export const EditorPane: React.FC<EditorPaneProps> = ({
  initialContent = '',
  onContentChange,
  onSave,
  editable = true,
  showPreview = true,
}) => {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>(showPreview ? 'split' : 'edit');
  const [dividerPosition, setDividerPosition] = useState(50); // percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
  }, [onContentChange]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar with view mode toggle */}
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {editable ? 'Editing' : 'Read-only'}
        </div>
        {renderViewModeButtons()}
      </div>

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
              initialValue={content}
              onChange={handleContentChange}
              onSave={onSave}
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
  );
};

export default EditorPane;
