import React, { useState, useRef, useCallback, useEffect } from 'react';
import MarkdownEditor, { MarkdownEditorRef } from './MarkdownEditor';
import MarkdownPreview from './MarkdownPreview';
import MarkdownToolbar, { ToolbarAction } from './MarkdownToolbar';
import { PageMetadata } from './PagePropertiesPanel';
import { CreatePageFromLinkModal } from '../pages/CreatePageFromLinkModal';
import { InspectorPanel } from './InspectorPanel';
import { ResizeDivider } from './ResizeDivider';
import { useAttachments } from '../../hooks/useAttachments';
import { getLayout, setLayout } from '../../stores/layoutStore';
import { Backlink } from '../../hooks/usePages';
import { useMediaQuery, MOBILE } from '../../hooks/useMediaQuery';
import { MobileDrawer } from '../common/MobileDrawer';

interface EditorPaneProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onSave?: () => Promise<void> | void;
  editable?: boolean;
  showPreview?: boolean;
  metadata?: PageMetadata;
  onMetadataChange?: (metadata: Partial<PageMetadata>) => void;
  pageGuid?: string;
  isSaving?: boolean;
  currentUserId?: string;
  currentUserRole?: 'Admin' | 'Standard';
  pageAuthorId?: string;
  draftContent?: string;
  serverMetadata?: PageMetadata;
  /** Backlinks for linked pages tab */
  backlinks?: Backlink[];
  backlinksLoading?: boolean;
  onPageClick?: (guid: string) => void;
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
  pageGuid,
  isSaving = false,
  currentUserId,
  currentUserRole,
  pageAuthorId,
  draftContent,
  serverMetadata,
  backlinks = [],
  backlinksLoading = false,
  onPageClick,
}) => {
  const isMobile = useMediaQuery(MOBILE);

  // Initialize with draft content if available, otherwise server content.
  // key={pageGuid} on this component ensures fresh state per page.
  const [content, setContent] = useState(draftContent ?? initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>(
    showPreview ? (draftContent != null ? 'split' : 'preview') : 'edit'
  );
  const [dividerPosition, setDividerPosition] = useState(() => getLayout().editorSplitPosition);
  const [showInspector, setShowInspector] = useState(() => getLayout().inspectorVisible);
  const [inspectorWidth, setInspectorWidth] = useState(() => getLayout().inspectorWidth);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  // On mobile, force edit or preview — never split
  const effectiveViewMode: ViewMode = isMobile && viewMode === 'split' ? 'edit' : viewMode;
  const [showCreatePageModal, setShowCreatePageModal] = useState(false);
  const [brokenLinkData, setBrokenLinkData] = useState<{ text: string; target: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  // Server baseline for dirty detection (initialContent = server content)
  const savedContentRef = useRef<string>(initialContent);
  const savedMetadataRef = useRef<PageMetadata | undefined>(serverMetadata ?? metadata);
  const [attachmentActionError, setAttachmentActionError] = useState<string | null>(null);
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const { uploadFiles } = useAttachments(pageGuid || '');

  // Track if content or metadata has changed vs server baseline
  const isContentDirty = content !== savedContentRef.current;
  const isMetadataDirty = metadata !== undefined && savedMetadataRef.current !== undefined && (
    metadata.title !== savedMetadataRef.current.title ||
    metadata.status !== savedMetadataRef.current.status ||
    JSON.stringify(metadata.tags) !== JSON.stringify(savedMetadataRef.current.tags) ||
    JSON.stringify(metadata.properties) !== JSON.stringify(savedMetadataRef.current.properties)
  );
  const isDirty = isContentDirty || isMetadataDirty;

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
      // Update saved references after successful save
      savedContentRef.current = content;
      savedMetadataRef.current = metadata;
    }
  }, [onSave, isDirty, content, metadata]);

  // Update baseline when server content changes (e.g., after save + refetch)
  useEffect(() => {
    if (initialContent !== savedContentRef.current) {
      if (content === savedContentRef.current) {
        setContent(initialContent);
      }
      savedContentRef.current = initialContent;
      savedMetadataRef.current = serverMetadata ?? metadata;
    }
  }, [initialContent, serverMetadata, metadata, content]);

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

  const buildMarkdownFromUpload = useCallback((filename: string, contentType: string) => {
    const altText = filename.replace(/\.[^/.]+$/, '') || 'attachment';
    const isImage = contentType.toLowerCase().startsWith('image/');

    // URL-encode the filename so spaces/special chars don't break markdown link parsing
    const attachmentPath = encodeURIComponent(filename);

    if (isImage) {
      return `![${altText}](${attachmentPath})`;
    }

    return `[${filename}](${attachmentPath})`;
  }, []);

  const handleAttachmentFilesSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0 || !pageGuid) {
      return;
    }

    setAttachmentActionError(null);

    try {
      const { successful, failed } = await uploadFiles(files);

      if (successful.length > 0) {
        if (editorRef.current) {
          const markdownBlock = successful
            .map((upload) => buildMarkdownFromUpload(upload.filename, upload.contentType))
            .join('\n');

          editorRef.current.insertMarkdown(`${markdownBlock}\n`);
        }
        setAttachmentRefreshKey(prev => prev + 1);
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

  // Handle drag-to-resize on images in the preview.
  // Updates the markdown source with the new width using ![alt|WIDTH](src) syntax.
  const handleImageResize = useCallback((imageSrc: string, widthPx: number) => {
    // imageSrc is the URI as written in the markdown (e.g. "Sample%20JPEG.jpg")
    // Escape it for use in a regex
    const escaped = imageSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match ![anything](imageSrc) — the alt may already contain |SIZE
    const pattern = new RegExp(`(!\\[)((?:[^\\]]|\\\\\\])*)\\]\\(${escaped}\\)`, 'g');
    const updatedContent = content.replace(pattern, (_match, prefix, alt) => {
      // Strip any existing |SIZE from the alt text
      const cleanAlt = alt.replace(/\|(\d+%?(?:x\d+%?)?)$/, '');
      return `${prefix}${cleanAlt}|${widthPx}](${imageSrc})`;
    });
    if (updatedContent !== content) {
      handleContentChange(updatedContent);
    }
  }, [content, handleContentChange]);

  const handleEditorPreviewResize = useCallback((px: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const pct = (px / containerWidth) * 100;
    const clamped = Math.min(Math.max(pct, 20), 80);
    setDividerPosition(clamped);
    setLayout({ editorSplitPosition: clamped });
  }, []);

  const renderViewModeButtons = () => (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded">
      <button
        onClick={() => setViewMode('edit')}
        className={`px-3 py-1.5 text-sm rounded ${
          effectiveViewMode === 'edit'
            ? 'bg-white dark:bg-gray-700 shadow'
            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        title="Edit only"
        aria-label="Edit only mode"
      >
        Edit
      </button>
      {!isMobile && (
        <button
          onClick={() => setViewMode('split')}
          className={`px-3 py-1.5 text-sm rounded ${
            effectiveViewMode === 'split'
              ? 'bg-white dark:bg-gray-700 shadow'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title="Split view"
          aria-label="Split view mode"
        >
          Split
        </button>
      )}
      <button
        onClick={() => setViewMode('preview')}
        className={`px-3 py-1.5 text-sm rounded ${
          effectiveViewMode === 'preview'
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

  const mainAreaRef = useRef<HTMLDivElement>(null);

  const handleInspectorResize = useCallback((px: number) => {
    if (!mainAreaRef.current) return;
    const totalWidth = mainAreaRef.current.getBoundingClientRect().width;
    const newWidth = totalWidth - px;
    const clamped = Math.min(Math.max(newWidth, 250), 600);
    setInspectorWidth(clamped);
    setLayout({ inspectorWidth: clamped });
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
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
  }, [content, onContentChange, onMetadataChange]);

  return (
    <div className="flex flex-col h-full">
      <input
        ref={attachmentInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleAttachmentFilesSelected}
        aria-label="Upload attachments"
      />

      {/* Top toolbar */}
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 gap-4 flex-wrap shrink-0">
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
          {isMobile ? (
            <button
              onClick={() => setMobileInspectorOpen(true)}
              className="p-2.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
              title="Page info"
              aria-label="Open page inspector"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => { const next = !showInspector; setShowInspector(next); setLayout({ inspectorVisible: next }); }}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                showInspector
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title={showInspector ? 'Hide inspector' : 'Show inspector'}
            >
              {showInspector ? 'Hide Inspector' : 'Inspector'}
            </button>
          )}
          {renderViewModeButtons()}
        </div>
      </div>

      {/* Markdown formatting toolbar */}
      {editable && (effectiveViewMode === 'edit' || effectiveViewMode === 'split') && (
        <MarkdownToolbar onAction={handleToolbarAction} disabled={!editable} compact={isMobile} />
      )}

      {attachmentActionError && (
        <div className="px-4 py-2 text-sm bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 shrink-0">
          {attachmentActionError}
        </div>
      )}

      {/* Main content: editor + inspector side by side */}
      <div ref={mainAreaRef} className="flex-1 flex overflow-hidden min-h-0">
        {/* Editor and/or preview panes */}
        <div ref={containerRef} className="flex-1 flex overflow-hidden min-w-0">
          {(effectiveViewMode === 'edit' || effectiveViewMode === 'split') && (
            <div
              className="overflow-hidden"
              style={{ width: effectiveViewMode === 'split' ? `${dividerPosition}%` : '100%' }}
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

          {effectiveViewMode === 'split' && (
            <ResizeDivider orientation="vertical" onResize={handleEditorPreviewResize} />
          )}

          {(effectiveViewMode === 'preview' || effectiveViewMode === 'split') && (
            <div
              className="overflow-hidden"
              style={{ width: effectiveViewMode === 'split' ? `${100 - dividerPosition}%` : '100%' }}
            >
              <MarkdownPreview
                content={content}
                onBrokenLinkClick={handleBrokenLinkClick}
                pageGuid={pageGuid}
                onImageResize={editable ? handleImageResize : undefined}
              />
            </div>
          )}
        </div>

        {/* Inspector panel — desktop: side panel; mobile: bottom sheet */}
        {!isMobile && showInspector && pageGuid && (
          <>
          <ResizeDivider orientation="vertical" onResize={handleInspectorResize} />
          <div className="shrink-0 overflow-hidden" style={{ width: `${inspectorWidth}px` }}>
            <InspectorPanel
              metadata={metadata}
              onMetadataChange={onMetadataChange}
              editable={editable}
              onTitleChange={handleTitleChange}
              pageGuid={pageGuid}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              pageAuthorId={pageAuthorId}
              onInsertMarkdown={handleAttachmentInsert}
              attachmentRefreshKey={attachmentRefreshKey}
              backlinks={backlinks}
              backlinksLoading={backlinksLoading}
              onPageClick={onPageClick}
            />
          </div>
          </>
        )}
      </div>

      {/* Mobile inspector bottom sheet */}
      {isMobile && pageGuid && (
        <MobileDrawer isOpen={mobileInspectorOpen} onClose={() => setMobileInspectorOpen(false)} side="bottom">
          <div className="h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Page Info</h3>
              <button
                onClick={() => setMobileInspectorOpen(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <InspectorPanel
              metadata={metadata}
              onMetadataChange={onMetadataChange}
              editable={editable}
              onTitleChange={handleTitleChange}
              pageGuid={pageGuid}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              pageAuthorId={pageAuthorId}
              onInsertMarkdown={handleAttachmentInsert}
              attachmentRefreshKey={attachmentRefreshKey}
              backlinks={backlinks}
              backlinksLoading={backlinksLoading}
              onPageClick={onPageClick}
            />
          </div>
        </MobileDrawer>
      )}

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
