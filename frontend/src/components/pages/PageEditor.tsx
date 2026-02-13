/**
 * PageEditor Component
 * 
 * Integrates the editor with backend APIs for loading and saving pages.
 * Features:
 * - Load page content on mount
 * - Autosave with optimistic updates
 * - Conflict detection (409 errors)
 * - Loading states and error handling
 * - Retry mechanism for failed saves
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EditorPane } from '../editor/EditorPane';
import { PageMetadata } from '../editor/PagePropertiesPanel';
import { usePageDetail, useUpdatePage } from '../../hooks/usePages';
import { UpdatePageRequest } from '../../types/page';

interface PageEditorProps {
  pageGuid: string;
  onPageDeleted?: () => void;
}

interface ConflictDialogProps {
  isOpen: boolean;
  onKeepLocal: () => void;
  onUseRemote: () => void;
  onCancel: () => void;
}

const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  onKeepLocal,
  onUseRemote,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Conflict Detected
        </h3>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          This page has been modified by another user. What would you like to do?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onKeepLocal}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Keep My Changes (Overwrite)
          </button>
          <button
            onClick={onUseRemote}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Use Their Changes (Discard Mine)
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel (Continue Editing)
          </button>
        </div>
      </div>
    </div>
  );
};

export const PageEditor: React.FC<PageEditorProps> = ({
  pageGuid,
  onPageDeleted: _onPageDeleted,
}) => {
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState<PageMetadata | undefined>();
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSavedVersionRef = useRef<string>('');
  const pendingSaveRef = useRef<UpdatePageRequest | null>(null);

  // Fetch page details
  const { data: pageData, isLoading, error, refetch } = usePageDetail(pageGuid);

  // Update page mutation
  const updatePage = useUpdatePage(pageGuid);

  // Load page content when data is fetched
  useEffect(() => {
    if (pageData) {
      setContent(pageData.content);
      lastSavedVersionRef.current = pageData.content;
      setMetadata({
        title: pageData.title,
        tags: pageData.tags,
        status: pageData.status,
        createdBy: pageData.createdBy,
        modifiedBy: pageData.modifiedBy,
        createdAt: pageData.createdAt,
        modifiedAt: pageData.modifiedAt,
      });
      setSaveError(null);
      setRetryCount(0);
    }
  }, [pageData]);

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  // Handle metadata changes
  const handleMetadataChange = useCallback((changes: Partial<PageMetadata>) => {
    setMetadata(prev => prev ? { ...prev, ...changes } : undefined);
  }, []);

  // Save function with conflict detection and retry logic
  const handleSave = useCallback(async () => {
    if (!metadata) return;

    const updateRequest: UpdatePageRequest = {
      content,
      title: metadata.title,
      tags: metadata.tags,
      status: metadata.status,
    };

    // Store pending save for retry
    pendingSaveRef.current = updateRequest;

    try {
      await updatePage.mutateAsync(updateRequest);
      
      // Success: update last saved version
      lastSavedVersionRef.current = content;
      setSaveError(null);
      setRetryCount(0);
      pendingSaveRef.current = null;
    } catch (error: any) {
      console.error('Save failed:', error);

      // Check for conflict (409 status)
      if (error.response?.status === 409) {
        setShowConflictDialog(true);
        return;
      }

      // Check for network or server errors
      if (error.response?.status >= 500 || !error.response) {
        // Server error or network error - implement retry
        if (retryCount < 3) {
          setSaveError(`Save failed. Retrying... (${retryCount + 1}/3)`);
          setRetryCount(prev => prev + 1);
          
          // Exponential backoff: 2s, 4s, 8s
          const delay = Math.pow(2, retryCount + 1) * 1000;
          setTimeout(() => {
            handleSave();
          }, delay);
        } else {
          setSaveError('Save failed after 3 retries. Your changes are saved locally.');
          setRetryCount(0);
        }
        return;
      }

      // Other errors (e.g., validation, auth)
      setSaveError(error.response?.data?.message || 'Failed to save page');
      setRetryCount(0);
    }
  }, [content, metadata, updatePage, retryCount]);

  // Conflict resolution: Keep local changes
  const handleKeepLocal = useCallback(async () => {
    setShowConflictDialog(false);
    
    if (!pendingSaveRef.current) return;

    try {
      // Force save with current content (overwrite remote changes)
      await updatePage.mutateAsync({
        ...pendingSaveRef.current,
        // Add force flag if your API supports it
        // force: true,
      });
      
      lastSavedVersionRef.current = content;
      setSaveError(null);
      pendingSaveRef.current = null;
    } catch (error: any) {
      setSaveError('Failed to save changes. Please try again.');
    }
  }, [content, updatePage]);

  // Conflict resolution: Use remote changes
  const handleUseRemote = useCallback(async () => {
    setShowConflictDialog(false);
    pendingSaveRef.current = null;
    
    // Refetch the page to get latest content
    const result = await refetch();
    if (result.data) {
      setContent(result.data.content);
      lastSavedVersionRef.current = result.data.content;
      setSaveError(null);
    }
  }, [refetch]);

  // Conflict resolution: Cancel (continue editing)
  const handleCancelConflict = useCallback(() => {
    setShowConflictDialog(false);
    pendingSaveRef.current = null;
    setSaveError('Conflict not resolved. Changes not saved.');
  }, []);

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
            {(error as any)?.response?.data?.message || 'An error occurred while loading the page.'}
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
    <div className="h-full flex flex-col">
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
          enableAutosave={true}
          autosaveDelay={5000}
          metadata={metadata}
          onMetadataChange={handleMetadataChange}
          showPropertiesPanel={true}
          pageGuid={pageGuid}
        />
      </div>

      {/* Conflict dialog */}
      <ConflictDialog
        isOpen={showConflictDialog}
        onKeepLocal={handleKeepLocal}
        onUseRemote={handleUseRemote}
        onCancel={handleCancelConflict}
      />
    </div>
  );
};

export default PageEditor;
