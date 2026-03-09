import React, { useState, useRef, useCallback, useEffect } from 'react';
import MarkdownEditor, { MarkdownEditorRef } from './MarkdownEditor';
import MarkdownPreview from './MarkdownPreview';
import MarkdownToolbar, { ToolbarAction } from './MarkdownToolbar';
import PagePropertiesPanel, { PageMetadata } from './PagePropertiesPanel';
import { CreatePageFromLinkModal } from '../pages/CreatePageFromLinkModal';
import { AttachmentManager } from './AttachmentManager';
import { useAttachments } from '../../hooks/useAttachments';

interface EditorPaneProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onSave?: () => Promise<void> | void;
  editable?: boolean;
  showPreview?: boolean;
  /** Page metadata for properties panel */
  metadata?: PageMetadata;
  /** Callback when metadata changes */
  onMetadataChange?: (metadata: Partial<PageMetadata>) => void;
  /** Show properties panel (default: false) */
  showPropertiesPanel?: boolean;
  /** Current page GUID for context when creating pages from links */
  pageGuid?: string;
  /** Is the save operation in progress */
  isSaving?: boolean;
  currentUserId?: string;
  currentUserRole?: 'Admin' | 'Standard';
  pageAuthorId?: string;
}

type ViewMode = 'split' | 'edit' | 'preview';

/**
 * Split-pane editor with markdown editing on left and live preview on right
 * Features:
 * - Markdown toolbar with formatting buttons
 * - Resizable divider between editor and preview
 * - Toggle between split, edit-only, and preview-only modes
 * - Synchronized content between editor and preview
 * - Manual save with unsaved changes indicator
 */
export const EditorPane: React.FC<EditorPaneProps> = ({
  initialContent = '',
  onContentChange,
  onSave,
  editable = true,
  showPreview = true,
  metadata,
  onMetadataChange,
  showPropertiesPanel = false,
  pageGuid,
  isSaving = false,
  currentUserId,
  currentUserRole,
  pageAuthorId,
}) => {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>(showPreview ? 'split' : 'edit');
  const [dividerPosition, setDividerPosition] = useState(50); // percentage
  const [showProperties, setShowProperties] = useState(showPropertiesPanel);
  const [showCreatePageModal, setShowCreatePageModal] = useState(false);
  const [brokenLinkData, setBrokenLinkData] = useState<{ text: string; target: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const lastLoadedPageGuidRef = useRef<string | undefined>(pageGuid);
  const savedContentRef = useRef<string>(initialContent);
  const [attachmentActionError, setAttachmentActionError] = useState<string | null>(null);
  const { uploadFiles } = useAttachments(pageGuid || '');
  
  // Track if content has changed
  const isDirty = content !== savedContentRef.current;
  
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
  }, [onContentChange]);

  // Handle manual save
  const handleManualSave = useCallback(async () => {
    if (onSave && isDirty) {
      await onSave();
      // Update saved content reference after successful save
      savedContentRef.current = content;
    }
  }, [onSave, isDirty, content]);

  // Update content ONLY when navigating to a different page
  // EditorPane owns the content state - PageEditor just provides initial content
  useEffect(() => {
    const pageChanged = pageGuid !== lastLoadedPageGuidRef.current;
    
    // Update when:
    // 1. Switching to a different page (pageChanged), OR
    // 2. Fresh data arrived for current page (initialContent changed from what we loaded)
    //    This happens when navigating back and API returns fresh data
    // WARNING: When changing pages, all unsaved changes are lost
    if (pageChanged) {
      // New page - load it
      setContent(initialContent);
      savedContentRef.current = initialContent;
      lastLoadedPageGuidRef.current = pageGuid;
    } else if (initialContent !== savedContentRef.current) {
      // Same page but fresh data from API (e.g., navigated back after saving)
      // Only update if we haven't made local edits (content === savedContentRef)
      if (content === savedContentRef.current) {
        setContent(initialContent);
        savedContentRef.current = initialContent;
      }
    }
  }, [pageGuid, initialContent, content]);

  // Handle toolbar action
  const handleToolbarAction = useCallback((action: ToolbarAction) => {
    if (action === 'attachment') {
      if (!pageGuid) {
        setAttachmentActionError('Save the page before uploading attachments.');
        return;
      }

      setAttachmentActionError(null);
      attachmentInputRef.current?.click();
      return;
    }

    if (editorRef.current) {
      editorRef.current.applyToolbarAction(action);
    }
  }, [pageGuid]);

  const buildMarkdownFromUpload = useCallback((filename: string, contentType: string, url: string) => {
    const altText = filename.replace(/\.[^/.]+$/, '') || 'attachment';
    const isImage = contentType.toLowerCase().startsWith('image/');
    
    // Use simple pageGuid/filename format for portability
    const attachmentPath = pageGuid ? `${pageGuid}/${filename}` : filename;

    if (isImage) {
      return `![${altText}](${attachmentPath})`;
    }

    return `[${filename}](${attachmentPath})`;
  }, [pageGuid]);

  const handleAttachmentFilesSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0 || !pageGuid) {
      return;
    }

    setAttachmentActionError(null);

    try {
      const { successful, failed } = await uploadFiles(files);

      if (successful.length > 0 && editorRef.current) {
        const markdownBlock = successful
          .map((upload) => buildMarkdownFromUpload(upload.filename, upload.contentType, upload.url))
          .join('\n');

        editorRef.current.insertMarkdown(`${markdownBlock}\n`);
      }

      if (failed.length > 0) {
        setAttachmentActionError(failed[0].error);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Attachment upload failed';
      setAttachmentActionError(message);
    } finally {
      event.target.value = '';
    }
  }, [buildMarkdownFromUpload, pageGuid, uploadFiles]);

  const handleAttachmentInsert = useCallback((markdown: string) => {
    editorRef.current?.insertMarkdown(`${markdown}\n`);
  }, []);

  // Handle broken link click - open modal to create page
  const handleBrokenLinkClick = useCallback((linkText: string, linkTarget: string) => {
    setBrokenLinkData({ text: linkText, target: linkTarget });
    setShowCreatePageModal(true);
  }, []);

  // Handle page creation from broken link
  const handlePageCreated = useCallback((newPageGuid: string, newPageTitle: string) => {
    // Update the link in the content to point to the new page
    // Replace [[linkTarget]] or [[linkTarget|text]] with [[newPageGuid|text]]
    if (brokenLinkData) {
      const { target } = brokenLinkData;
      
      // Find and replace the broken link with a valid link
      const wikiLinkRegex = new RegExp(`\\[\\[${target}(?:\\|([^\\]]+))?\\]\\]`, 'g');
      const updatedContent = content.replace(wikiLinkRegex, (_match, displayText) => {
        const text = displayText || newPageTitle;
        return `[[${newPageGuid}|${text}]]`;
      });
      
      handleContentChange(updatedContent);
      // Note: User must manually save after creating page from link
    }
    
    setShowCreatePageModal(false);
    setBrokenLinkData(null);
  }, [brokenLinkData, content, handleContentChange]);

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
    if (!editable) {
      return (
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-600 dark:text-gray-300">
          Read-only
        </div>
      );
    }

    if (isSaving) {
      return (
        <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-500 dark:border-blue-400 rounded text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <span className="animate-spin">⏳</span>
          Saving...
        </div>
      );
    }

    if (isDirty) {
      return (
        <div className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-600 dark:border-yellow-500 rounded text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
          <span>●</span>
          Unsaved changes
        </div>
      );
    }

    return (
      <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 border border-green-600 dark:border-green-500 rounded text-sm text-green-700 dark:text-green-300">
        ✓ All changes saved
      </div>
    );
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
        <input
          ref={attachmentInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleAttachmentFilesSelected}
          aria-label="Upload attachments"
        />

        {/* Top toolbar with view mode toggle and save status */}
        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {renderSaveStatus()}
            {editable && (
              <button
                onClick={handleManualSave}
                disabled={!isDirty || isSaving}
                className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                title={isDirty ? 'Save changes (Ctrl+S)' : 'No changes to save'}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            {renderViewModeButtons()}
          </div>
        </div>

        {/* Markdown formatting toolbar */}
        {editable && (viewMode === 'edit' || viewMode === 'split') && (
          <MarkdownToolbar onAction={handleToolbarAction} disabled={!editable} />
        )}

        {attachmentActionError && (
          <div className="px-4 py-2 text-sm bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            {attachmentActionError}
          </div>
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
              <MarkdownPreview 
                content={content} 
                onBrokenLinkClick={handleBrokenLinkClick}
                pageGuid={pageGuid}
              />
            </div>
          )}
        </div>

        {pageGuid && (
          <div className="h-64 border-t border-gray-200 dark:border-gray-700 min-h-0">
            <AttachmentManager
              pageGuid={pageGuid}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              pageAuthorId={pageAuthorId}
              onInsertMarkdown={handleAttachmentInsert}
              className="border-0"
            />
          </div>
        )}
      </div>

      {/* Create Page from Link Modal */}
      <CreatePageFromLinkModal
        isOpen={showCreatePageModal}
        onClose={() => {
          setShowCreatePageModal(false);
          setBrokenLinkData(null);
        }}
        linkText={brokenLinkData?.text || ''}
        currentPageGuid={pageGuid}
        onPageCreated={handlePageCreated}
      />
    </div>
  );
};

export default EditorPane;
