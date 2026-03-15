/**
 * PagesView Component
 * 
 * Main page view that integrates all page tree functionality:
 * - Page tree navigation
 * - Context menu
 * - New page modal
 * - Delete confirmation
 * - Inline rename
 */

import React, { useState, useCallback } from 'react';
import { ResizeDivider } from '../editor/ResizeDivider';
import { getLayout, setLayout } from '../../stores/layoutStore';
import { PageTree } from './PageTree';
import { PageContextMenu } from './PageContextMenu';
import { NewPageModal } from './NewPageModal';
import { PageRenameInline } from './PageRenameInline';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EditorErrorBoundary } from '../common/EditorErrorBoundary';
import { PageEditor } from './PageEditor';
import { PageTreeNode } from '../../types/page';
import { useDeletePage } from '../../hooks/usePages';

export const PagesView: React.FC = () => {
  const [activePageGuid, setActivePageGuid] = useState<string | undefined>();
  const [contextMenu, setContextMenu] = useState<{
    page: PageTreeNode;
    position: { x: number; y: number };
  } | null>(null);
  const [newPageModal, setNewPageModal] = useState<{
    isOpen: boolean;
    parentGuid: string | null;
  }>({ isOpen: false, parentGuid: null });
  const [renamingPage, setRenamingPage] = useState<PageTreeNode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    page: PageTreeNode | null;
  }>({ isOpen: false, page: null });
  const [treeRefreshTrigger, setTreeRefreshTrigger] = useState(0);
  const [treeWidth, setTreeWidth] = useState(() => getLayout().treeWidth);

  const handleTreeResize = useCallback((px: number) => {
    const w = Math.min(Math.max(px, 200), 600);
    setTreeWidth(w);
    setLayout({ treeWidth: w });
  }, []);

  const deletePage = useDeletePage();

  const handlePageSelect = (guid: string) => {
    setActivePageGuid(guid);
    // TODO: Load and display page content
  };

  const handleContextMenu = (event: React.MouseEvent, page: PageTreeNode) => {
    event.preventDefault();
    setContextMenu({
      page,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const handleRename = (page: PageTreeNode) => {
    setRenamingPage(page);
  };

  const handleDelete = (page: PageTreeNode) => {
    setDeleteConfirm({ isOpen: true, page });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.page) return;

    try {
      await deletePage.mutateAsync({
        guid: deleteConfirm.page.guid,
        recursive: deleteConfirm.page.hasChildren,
      });
      setDeleteConfirm({ isOpen: false, page: null });
      setActivePageGuid(undefined);
      // Trigger tree refresh
      setTreeRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to delete page:', error);
      alert('Failed to delete page. Please try again.');
    }
  };

  const handleMove = (page: PageTreeNode) => {
    // TODO: Implement move dialog
    console.log('Move page:', page);
    alert('Move functionality coming soon! For now, use drag-and-drop.');
  };

  const handleNewChild = (page: PageTreeNode) => {
    setNewPageModal({ isOpen: true, parentGuid: page.guid });
  };

  const handleNewRootPage = () => {
    setNewPageModal({ isOpen: true, parentGuid: null });
  };

  const handlePageCreated = () => {
    // Trigger tree refresh after page creation
    setTreeRefreshTrigger(prev => prev + 1);
  };

  const handlePageMoved = () => {
    // Trigger tree refresh after page move
    setTreeRefreshTrigger(prev => prev + 1);
  };

  const handlePageRenamed = () => {
    // Trigger tree refresh after rename
    setTreeRefreshTrigger(prev => prev + 1);
  };

  return (
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar with page tree */}
        <div className="bg-white flex flex-col shrink-0" style={{ width: `${treeWidth}px` }}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Pages</h2>
              <button
                onClick={handleNewRootPage}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                aria-label="New page"
                title="Create new root page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Page Tree */}
          <div className="flex-1 overflow-y-auto p-2">
            <PageTree
              key={treeRefreshTrigger}
              activePageGuid={activePageGuid}
              onPageSelect={handlePageSelect}
              onContextMenu={handleContextMenu}
              onNewChild={handleNewChild}
              onPageMoved={handlePageMoved}
            />
          </div>
        </div>

        <ResizeDivider orientation="vertical" onResize={handleTreeResize} />

        {/* Main content area */}
        <div className="flex-1 overflow-hidden min-w-0">
          {activePageGuid ? (
            <EditorErrorBoundary
              onReset={() => {
                // Reset to no page selected on error
                setActivePageGuid(undefined);
              }}
            >
              <PageEditor
                pageGuid={activePageGuid}
                onPageDeleted={() => {
                  // Clear selection when page is deleted
                  setActivePageGuid(undefined);
                }}
                onNavigateToPage={(guid) => {
                  // Navigate to a different page
                  setActivePageGuid(guid);
                }}
              />
            </EditorErrorBoundary>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-lg mb-2">No page selected</p>
                <p className="text-sm">Select a page from the tree or create a new one</p>
              </div>
            </div>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <PageContextMenu
            page={contextMenu.page}
            position={contextMenu.position}
            onClose={() => setContextMenu(null)}
            onRename={handleRename}
            onDelete={handleDelete}
            onMove={handleMove}
            onNewChild={handleNewChild}
          />
        )}

        {/* New Page Modal */}
        <NewPageModal
          isOpen={newPageModal.isOpen}
          onClose={() => setNewPageModal({ isOpen: false, parentGuid: null })}
          defaultParentGuid={newPageModal.parentGuid}
          onPageCreated={handlePageCreated}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title="Delete Page"
          message={
            deleteConfirm.page?.hasChildren
              ? `Are you sure you want to delete "${deleteConfirm.page?.title}" and all its child pages? This action cannot be undone.`
              : `Are you sure you want to delete "${deleteConfirm.page?.title}"? This action cannot be undone.`
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirm({ isOpen: false, page: null })}
          isDangerous
        />

        {/* Rename Inline Editor (rendered in modal or overlay) */}
        {renamingPage && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Rename Page</h3>
              <PageRenameInline
                page={renamingPage}
                onComplete={() => {
                  setRenamingPage(null);
                  handlePageRenamed();
                }}
                onCancel={() => setRenamingPage(null)}
              />
            </div>
          </div>
        )}
      </div>
  );
};
