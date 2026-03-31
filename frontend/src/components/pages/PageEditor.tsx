/**
 * PageEditor Component
 *
 * Integrates the editor with backend APIs for loading and saving pages.
 * Preserves unsaved edits when navigating between pages (in-memory drafts).
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EditorPane } from '../editor/EditorPane';
import { PageMetadata } from '../editor/PagePropertiesPanel';
import { usePageDetail, useUpdatePage, useBacklinks, usePageChildrenWithProperties } from '../../hooks/usePages';
import { usePageTypes } from '../../hooks/usePageTypes';
import { UpdatePageRequest, BoardConfig } from '../../types/page';
import { apiClient } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDraft, saveDraft, clearDraft } from '../../stores/draftsStore';
import { BoardView } from '../board/BoardView';
import { BoardSettingsPanel } from '../board/BoardSettingsPanel';
import { Breadcrumbs } from '../common/Breadcrumbs';

interface PageEditorProps {
  pageGuid: string;
  onPageDeleted?: () => void;
  onNavigateToPage?: (guid: string) => void;
  /** When true, open in edit mode (e.g. newly created page) */
  initialEditMode?: boolean;
  /** Called after initialEditMode has been consumed so it doesn't persist across navigations */
  onEditModeConsumed?: () => void;
}

function metadataFromPage(page: {
  title: string; tags: string[]; status: 'draft' | 'published' | 'archived';
  pageType?: string;
  properties?: Record<string, import('../../types/page').PageProperty>;
  createdBy: string; modifiedBy: string;
  createdAt: string; modifiedAt: string; guid: string;
}): PageMetadata {
  return {
    title: page.title,
    tags: page.tags,
    status: page.status,
    ...(page.pageType ? { pageType: page.pageType } : {}),
    ...(page.properties ? { properties: page.properties } : {}),
    createdBy: page.createdBy,
    modifiedBy: page.modifiedBy,
    createdAt: page.createdAt,
    modifiedAt: page.modifiedAt,
    guid: page.guid,
  };
}

export const PageEditor: React.FC<PageEditorProps> = ({
  pageGuid,
  onNavigateToPage,
  initialEditMode,
  onEditModeConsumed,
}) => {
  const { user } = useAuth();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch page details
  const { data: pageData, isLoading, error, refetch } = usePageDetail(pageGuid);

  // Fetch backlinks
  const backlinksQuery = useBacklinks(pageGuid);
  const backlinksData = backlinksQuery?.data;
  const backlinksLoading = backlinksQuery?.isLoading ?? false;

  // Board view: fetch children with properties to detect board eligibility
  const { data: childrenWithProps = [] } = usePageChildrenWithProperties(pageGuid);
  const { data: pageTypesList = [] } = usePageTypes();

  // Board config is now a first-class frontmatter field
  const boardConfig = pageData?.boardConfig;

  // Check if board view is available
  const boardEligible = useMemo(() => {
    if (boardConfig?.targetTypeGuid) return true;
    if (childrenWithProps.length === 0) return false;
    const typeGuids = new Set(pageTypesList.map((pt) => pt.guid));
    return childrenWithProps.some(
      (child) =>
        child.pageType &&
        typeGuids.has(child.pageType) &&
        child.properties?.state !== undefined
    );
  }, [childrenWithProps, pageTypesList, boardConfig]);

  // Page types that have a 'state' property (candidates for board target type)
  const boardableTypes = useMemo(
    () => pageTypesList.filter((pt) => pt.properties.some((p) => p.name === 'state')),
    [pageTypesList],
  );

  const [activeView, setActiveView] = useState<'content' | 'board'>('content');
  const [showBoardSettings, setShowBoardSettings] = useState(false);

  // Sync default view when boardConfig loads (async)
  const appliedDefaultRef = useRef<string | null>(null);
  useEffect(() => {
    if (boardConfig?.defaultView === 'board' && appliedDefaultRef.current !== pageGuid) {
      appliedDefaultRef.current = pageGuid;
      setActiveView('board');
    }
  }, [boardConfig, pageGuid]);

  // Persist board config as a first-class frontmatter field
  const saveBoardConfig = useCallback(
    async (newConfig: BoardConfig | null) => {
      try {
        await apiClient.put(`/pages/${pageGuid}`, { boardConfig: newConfig });
        refetch();
      } catch {
        // Silently fail — the board still works, just won't persist
      }
    },
    [pageGuid, refetch],
  );

  // Update page mutation
  const updatePage = useUpdatePage(pageGuid);

  // Resolve initial content: draft takes priority over server data.
  // Computed synchronously during render — no effect timing issues.
  const draft = pageData?.guid === pageGuid ? getDraft(pageGuid) : undefined;
  const serverMeta = pageData?.guid === pageGuid ? metadataFromPage(pageData) : undefined;

  const resolvedContent = draft?.content ?? pageData?.content ?? '';
  const resolvedMetadata = draft?.metadata ?? serverMeta;
  const serverContent = pageData?.content ?? '';

  // Metadata state — needs to be state (not just a ref) so changes re-render
  // EditorPane for dirty detection and property panel display.
  const [metadata, setMetadata] = useState<PageMetadata | undefined>(resolvedMetadata);

  // Track current editing state via refs so the stash cleanup always has latest values
  const contentRef = useRef(resolvedContent);
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const handleContentChange = useCallback((newContent: string) => {
    contentRef.current = newContent;
  }, []);

  const handleMetadataChange = useCallback((changes: Partial<PageMetadata>) => {
    setMetadata(prev => prev ? { ...prev, ...changes } : undefined);
  }, []);

  // Stash edits when navigating away from a page
  useEffect(() => {
    return () => {
      if (pageGuid && metadataRef.current) {
        saveDraft(pageGuid, {
          content: contentRef.current,
          metadata: metadataRef.current,
        });
      }
    };
  }, [pageGuid]);

  // Sync refs and metadata state when a new page's data arrives (runs AFTER
  // stash cleanup, so the old page's content is safely stashed first).
  const syncedGuidRef = useRef<string>();
  useEffect(() => {
    if (syncedGuidRef.current === pageGuid) return;
    if (!pageData || pageData.guid !== pageGuid) return;
    contentRef.current = resolvedContent;
    setMetadata(resolvedMetadata);
    syncedGuidRef.current = pageGuid;
  }, [pageGuid, pageData, resolvedContent, resolvedMetadata]);

  // Save function
  const handleSave = useCallback(async () => {
    const meta = metadataRef.current;
    const content = contentRef.current;
    if (!meta) return;

    const updateRequest: UpdatePageRequest = {
      content,
      title: meta.title,
      tags: meta.tags,
      status: meta.status,
      ...(meta.pageType !== undefined ? { pageType: meta.pageType || null } : {}),
      ...(meta.properties ? { properties: meta.properties } : {}),
    };

    try {
      await updatePage.mutateAsync(updateRequest);
      clearDraft(pageGuid);
      setSaveError(null);
      // Refetch to get server-confirmed data
      refetch();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setSaveError(err.response?.data?.message || 'Failed to save page. Please try again.');
    }
  }, [updatePage, pageGuid, refetch]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Failed to Load Page
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'An error occurred while loading the page.'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Breadcrumbs
        pageGuid={pageGuid}
        pageTitle={metadata?.title || pageData?.title || 'Untitled'}
        onNavigate={(guid) => onNavigateToPage?.(guid)}
        onNavigateHome={() => onNavigateToPage?.('')}
      />

      {saveError && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-red-800 dark:text-red-200">{saveError}</span>
            </div>
            <button
              onClick={() => setSaveError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Content / Board view toggle */}
      {boardEligible && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          <button
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === 'content'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveView('content')}
          >
            Content
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === 'board'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveView('board')}
          >
            Board
          </button>

          {/* Board settings — visible when board tab is active */}
          {activeView === 'board' && (
            <div className="ml-auto relative">
              <button
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                onClick={() => setShowBoardSettings(!showBoardSettings)}
                title="Board settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {showBoardSettings && (
                <BoardSettingsPanel
                  config={boardConfig}
                  boardableTypes={boardableTypes}
                  currentColumns={[]}
                  onSave={(config) => {
                    saveBoardConfig(config);
                    setShowBoardSettings(false);
                  }}
                  onClose={() => setShowBoardSettings(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeView === 'board' && boardEligible ? (
          <BoardView
            parentGuid={pageGuid}
            boardConfig={boardConfig}
            onNavigateToPage={(guid) => onNavigateToPage?.(guid)}
          />
        ) : (
          <EditorPane
            key={pageGuid}
            initialContent={serverContent}
            draftContent={draft && draft.content !== serverContent ? draft.content : undefined}
            onContentChange={handleContentChange}
            onSave={handleSave}
            editable={true}
            showPreview={true}
            metadata={metadata}
            serverMetadata={serverMeta}
            onMetadataChange={handleMetadataChange}
            pageGuid={pageGuid}
            isSaving={updatePage.isPending}
            currentUserId={user?.userId}
            currentUserRole={user?.role}
            pageAuthorId={metadata?.createdBy}
            backlinks={backlinksData?.backlinks || []}
            backlinksLoading={backlinksLoading}
            onPageClick={onNavigateToPage}
            forceEditMode={initialEditMode}
            onEditModeConsumed={onEditModeConsumed}
          />
        )}
      </div>
    </div>
  );
};

export default PageEditor;
