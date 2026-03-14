/**
 * PageEditor Component
 *
 * Integrates the editor with backend APIs for loading and saving pages.
 * Preserves unsaved edits when navigating between pages (in-memory drafts).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EditorPane } from '../editor/EditorPane';
import { PageMetadata } from '../editor/PagePropertiesPanel';
import { usePageDetail, useUpdatePage, useBacklinks } from '../../hooks/usePages';
import { UpdatePageRequest } from '../../types/page';
import { LinkedPagesPanel } from './LinkedPagesPanel';
import { useAuth } from '../../contexts/AuthContext';
import { getDraft, saveDraft, clearDraft } from '../../stores/draftsStore';

interface PageEditorProps {
  pageGuid: string;
  onPageDeleted?: () => void;
  onNavigateToPage?: (guid: string) => void;
}

function metadataFromPage(page: {
  title: string; tags: string[]; status: 'draft' | 'published' | 'archived';
  createdBy: string; modifiedBy: string;
  createdAt: string; modifiedAt: string; guid: string;
}): PageMetadata {
  return {
    title: page.title,
    tags: page.tags,
    status: page.status,
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
}) => {
  const { user } = useAuth();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch page details
  const { data: pageData, isLoading, error, refetch } = usePageDetail(pageGuid);

  // Fetch backlinks
  const backlinksQuery = useBacklinks(pageGuid);
  const backlinksData = backlinksQuery?.data;
  const backlinksLoading = backlinksQuery?.isLoading ?? false;

  // Update page mutation
  const updatePage = useUpdatePage(pageGuid);

  // Resolve initial content: draft takes priority over server data.
  // Computed synchronously during render — no effect timing issues.
  const draft = pageData?.guid === pageGuid ? getDraft(pageGuid) : undefined;
  const serverMeta = pageData?.guid === pageGuid ? metadataFromPage(pageData) : undefined;

  const resolvedContent = draft?.content ?? pageData?.content ?? '';
  const resolvedMetadata = draft?.metadata ?? serverMeta;
  const serverContent = pageData?.content ?? '';

  // Track current editing state via refs so the stash cleanup always has latest values
  const contentRef = useRef(resolvedContent);
  const metadataRef = useRef(resolvedMetadata);

  const handleContentChange = useCallback((newContent: string) => {
    contentRef.current = newContent;
  }, []);

  const handleMetadataChange = useCallback((changes: Partial<PageMetadata>) => {
    metadataRef.current = metadataRef.current ? { ...metadataRef.current, ...changes } : undefined;
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

  // Sync refs when a new page's data arrives (runs AFTER stash cleanup,
  // so the old page's content is safely stashed before we overwrite the refs).
  const syncedGuidRef = useRef<string>();
  useEffect(() => {
    if (syncedGuidRef.current === pageGuid) return;
    if (!pageData || pageData.guid !== pageGuid) return;
    contentRef.current = resolvedContent;
    metadataRef.current = resolvedMetadata;
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
    <div className="h-full flex">
      <div className="flex-1 flex flex-col">
        {saveError && (
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2">
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

        <div className="flex-1 overflow-hidden">
          <EditorPane
            key={pageGuid}
            initialContent={serverContent}
            draftContent={draft ? draft.content : undefined}
            onContentChange={handleContentChange}
            onSave={handleSave}
            editable={true}
            showPreview={true}
            metadata={resolvedMetadata}
            serverMetadata={serverMeta}
            onMetadataChange={handleMetadataChange}
            showPropertiesPanel={true}
            pageGuid={pageGuid}
            isSaving={updatePage.isPending}
            currentUserId={user?.userId}
            currentUserRole={user?.role}
            pageAuthorId={resolvedMetadata?.createdBy}
          />
        </div>
      </div>

      <div className="w-80 flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700">
        <div className="h-full min-h-0">
          <LinkedPagesPanel
            pageGuid={pageGuid}
            backlinks={backlinksData?.backlinks || []}
            isLoading={backlinksLoading}
            onPageClick={(guid) => {
              if (onNavigateToPage) {
                onNavigateToPage(guid);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PageEditor;
