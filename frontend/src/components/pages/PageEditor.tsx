/**
 * PageEditor Component
 * 
 * Integrates the editor with backend APIs for loading and saving pages.
 * Features:
 * - Load page content on mount
 * - Manual save with simple error handling
 * - Loading states
 * - WARNING: Changing pages discards unsaved changes
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EditorPane } from '../editor/EditorPane';
import { PageMetadata } from '../editor/PagePropertiesPanel';
import { usePageDetail, useUpdatePage, useBacklinks } from '../../hooks/usePages';
import { UpdatePageRequest } from '../../types/page';
import { LinkedPagesPanel } from './LinkedPagesPanel';

interface PageEditorProps {
  pageGuid: string;
  onPageDeleted?: () => void;
  onNavigateToPage?: (guid: string) => void;
}

export const PageEditor: React.FC<PageEditorProps> = ({
  pageGuid,
  onNavigateToPage,
}) => {
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState<PageMetadata | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastLoadedPageGuidRef = useRef<string | undefined>();

  // Fetch page details
  const { data: pageData, isLoading, error, refetch } = usePageDetail(pageGuid);

  // Fetch backlinks
  const backlinksQuery = useBacklinks(pageGuid);
  const backlinksData = backlinksQuery?.data;
  const backlinksLoading = backlinksQuery?.isLoading ?? false;

  // Update page mutation
  const updatePage = useUpdatePage(pageGuid);

  // Load page content when data is fetched or page changes
  useEffect(() => {
    console.log('PageEditor effect:', {
      pageGuid,
      hasPageData: !!pageData,
      pageDataGuid: pageData?.guid,
      pageDataContent: pageData?.content?.substring(0, 50),
      lastLoaded: lastLoadedPageGuidRef.current,
    });
    
    if (pageData && pageData.guid === pageGuid) {
      console.log('PageEditor: Setting content from pageData:', pageData.content.substring(0, 50));
      
      // Always update content when pageData changes (including fresh data from API)
      // WARNING: This discards any unsaved changes
      setContent(pageData.content);
      lastLoadedPageGuidRef.current = pageGuid;
      
      // Always update metadata
      setMetadata({
        title: pageData.title,
        tags: pageData.tags,
        status: pageData.status,
        createdBy: pageData.createdBy,
        modifiedBy: pageData.modifiedBy,
        createdAt: pageData.createdAt,
        modifiedAt: pageData.modifiedAt,
        guid: pageData.guid,
      });
      setSaveError(null);
    }
  }, [pageData, pageGuid]);

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  // Handle metadata changes
  const handleMetadataChange = useCallback((changes: Partial<PageMetadata>) => {
    setMetadata(prev => prev ? { ...prev, ...changes } : undefined);
  }, []);

  // Simple save function
  const handleSave = useCallback(async () => {
    if (!metadata) {
      return;
    }

    const updateRequest: UpdatePageRequest = {
      content,
      title: metadata.title,
      tags: metadata.tags,
      status: metadata.status,
    };

    try {
      const updatedPage = await updatePage.mutateAsync(updateRequest);
      
      // Update metadata with server response
      if (updatedPage) {
        setMetadata({
          title: updatedPage.title,
          tags: updatedPage.tags,
          status: updatedPage.status,
          createdBy: updatedPage.createdBy,
          modifiedBy: updatedPage.modifiedBy,
          createdAt: updatedPage.createdAt,
          modifiedAt: updatedPage.modifiedAt,
          guid: updatedPage.guid,
        });
      }
      
      setSaveError(null);
    } catch (error: unknown) {
      // Display error message
      const err = error as { response?: { data?: { message?: string } } };
      setSaveError(err.response?.data?.message || 'Failed to save page. Please try again.');
    }
  }, [content, metadata, updatePage]);

  // Render loading skeleton
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

  // Render error state
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

  // Render editor
  return (
    <div className="h-full flex">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col">
        {/* Error banner */}
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

        {/* Editor pane */}
        <div className="flex-1 overflow-hidden">
          <EditorPane
            initialContent={content}
            onContentChange={handleContentChange}
            onSave={handleSave}
            editable={true}
            showPreview={true}
            metadata={metadata}
            onMetadataChange={handleMetadataChange}
            showPropertiesPanel={true}
            pageGuid={pageGuid}
            isSaving={updatePage.isPending}
          />
        </div>
      </div>

      {/* Linked Pages Sidebar */}
      <div className="w-80 flex-shrink-0">
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
  );
};

export default PageEditor;
