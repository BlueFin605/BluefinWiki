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

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ResizeDivider } from '../editor/ResizeDivider';
import { getLayout, setLayout } from '../../stores/layoutStore';
import { PageTree } from './PageTree';
import { PageContextMenu } from './PageContextMenu';
import { NewPageModal } from './NewPageModal';
import { PageRenameInline } from './PageRenameInline';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EditorErrorBoundary } from '../common/EditorErrorBoundary';
import { PageEditor } from './PageEditor';
import { SearchDialog } from '../search/SearchDialog';
import { MobileDrawer } from '../common/MobileDrawer';
import { PageTreeNode } from '../../types/page';
import { useDeletePage } from '../../hooks/usePages';
import { useMediaQuery, DESKTOP } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';

export const PagesView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  // Extract page guid from URL path: /pages/:guid
  const initialPageGuid = (() => {
    const match = location.pathname.match(/^\/pages\/([a-f0-9-]+)/i);
    return match ? match[1] : undefined;
  })();

  const [activePageGuid, setActivePageGuid] = useState<string | undefined>(initialPageGuid);
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
  const [ensureExpanded, setEnsureExpanded] = useState<string[]>([]);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [treeWidth, setTreeWidth] = useState(() => getLayout().treeWidth);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP);

  // Cmd/Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTreeResize = useCallback((px: number) => {
    const w = Math.min(Math.max(px, 200), 600);
    setTreeWidth(w);
    setLayout({ treeWidth: w });
  }, []);

  const deletePage = useDeletePage();

  const handlePageSelect = (guid: string) => {
    setActivePageGuid(guid);
    setOpenInEditMode(false);
    setIsDrawerOpen(false);
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
    } catch (error: unknown) {
      console.error('Failed to delete page:', error);
      const axiosError = error as { response?: { data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to delete page.';
      alert(message);
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

  const handlePageCreated = (newPageGuid: string) => {
    // Select the new page and open in edit mode
    setActivePageGuid(newPageGuid);
    setOpenInEditMode(true);
    // Expand the parent so the new page is visible in the tree
    if (newPageModal.parentGuid) {
      setEnsureExpanded(prev => [...prev, newPageModal.parentGuid!]);
    }
  };

  const handlePageMoved = () => {
    // Query cache invalidation from the mutation handles tree refresh
  };

  const handlePageRenamed = () => {
    // Query cache invalidation from the mutation handles tree refresh
  };

  // Sidebar content shared between desktop sidebar and mobile drawer
  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Pages</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setIsSearchOpen(true); setIsDrawerOpen(false); }}
              className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Search wiki (Ctrl+K)"
              title="Search wiki (Ctrl+K)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={handleNewRootPage}
              className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="New page"
              title="Create new root page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Page Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        <PageTree
          activePageGuid={activePageGuid}
          ensureExpanded={ensureExpanded}
          onPageSelect={handlePageSelect}
          onContextMenu={handleContextMenu}
          onNewChild={handleNewChild}
          onPageMoved={handlePageMoved}
        />
      </div>

      {/* Settings link — admin only */}
      {isAdmin && (
        <div className="border-t border-gray-200 p-2">
          <button
            onClick={() => { navigate('/settings'); setIsDrawerOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      )}
    </>
  );

  const mainContent = (
    <div className="flex-1 overflow-hidden min-w-0">
      {activePageGuid ? (
        <EditorErrorBoundary
          onReset={() => setActivePageGuid(undefined)}
        >
          <PageEditor
            pageGuid={activePageGuid}
            onPageDeleted={() => setActivePageGuid(undefined)}
            onNavigateToPage={(guid) => setActivePageGuid(guid || undefined)}
            initialEditMode={openInEditMode}
            onEditModeConsumed={() => setOpenInEditMode(false)}
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
  );

  return (
      <div className="flex flex-col h-screen bg-gray-50 lg:flex-row">
        {/* Mobile header — visible below lg breakpoint */}
        {!isDesktop && (
          <header className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 shrink-0">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Open navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold text-gray-900 truncate mx-3 flex-1 text-center">
              BlueFinWiki
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={handleNewRootPage}
                className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                aria-label="New page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </header>
        )}

        {/* Mobile drawer for sidebar */}
        {!isDesktop && (
          <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
            {sidebarContent}
          </MobileDrawer>
        )}

        {/* Desktop sidebar — visible at lg and above */}
        {isDesktop && (
          <>
            <div className="bg-white flex flex-col shrink-0" style={{ width: `${treeWidth}px` }}>
              {sidebarContent}
            </div>
            <ResizeDivider orientation="vertical" onResize={handleTreeResize} />
          </>
        )}

        {/* Main content area */}
        {mainContent}

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

        {/* Search Dialog */}
        <SearchDialog
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(pageId) => {
            setActivePageGuid(pageId);
            setIsSearchOpen(false);
          }}
        />
      </div>
  );
};
