/**
 * PageTree Component
 * 
 * Displays a hierarchical tree of pages with support for:
 * - Recursive rendering of nested pages
 * - Expand/collapse functionality
 * - Context menu for page operations
 * - Drag-and-drop to move pages
 * - Keyboard navigation
 */

import React, { useState, useCallback } from 'react';
import { PageTreeItem } from './PageTreeItem';
import { PageTreeNode } from '../../types/page';
import { usePageChildren, useMovePage } from '../../hooks/usePages';

interface PageTreeProps {
  activePageGuid?: string;
  onPageSelect: (guid: string) => void;
  onContextMenu: (event: React.MouseEvent, page: PageTreeNode) => void;
  onNewChild: (page: PageTreeNode) => void;
}

export const PageTree: React.FC<PageTreeProps> = ({
  activePageGuid,
  onPageSelect,
  onContextMenu,
  onNewChild,
}) => {
  const [expandedGuids, setExpandedGuids] = useState<Set<string>>(new Set());
  const [draggedPage, setDraggedPage] = useState<PageTreeNode | null>(null);

  // Fetch root-level pages
  const { data: rootPages = [], isLoading, error } = usePageChildren(null);

  // Move page mutation
  const movePage = useMovePage(draggedPage?.guid || '');

  // Build tree structure from root pages
  const treeData = React.useMemo(() => {
    return rootPages;
  }, [rootPages]);

  // Toggle expand/collapse
  const handleToggleExpand = useCallback((guid: string) => {
    setExpandedGuids((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) {
        next.delete(guid);
      } else {
        next.add(guid);
      }
      return next;
    });
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: React.DragEvent, page: PageTreeNode) => {
    setDraggedPage(page);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', page.guid);
  }, []);

  const handleDragOver = useCallback(
    (event: React.DragEvent, targetPage: PageTreeNode) => {
      event.preventDefault();

      if (!draggedPage) return;

      // Prevent dropping a page on itself
      if (draggedPage.guid === targetPage.guid) {
        event.dataTransfer.dropEffect = 'none';
        return;
      }

      // Prevent dropping a parent page on its descendant
      // For now, we'll allow all moves and let the backend validate
      event.dataTransfer.dropEffect = 'move';
    },
    [draggedPage]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent, targetPage: PageTreeNode) => {
      event.preventDefault();

      if (!draggedPage) return;

      // Don't drop on itself
      if (draggedPage.guid === targetPage.guid) return;

      try {
        // Move the dragged page to be a child of the target page
        await movePage.mutateAsync({
          newParentGuid: targetPage.guid,
        });

        setDraggedPage(null);
      } catch (error) {
        console.error('Failed to move page:', error);
        alert('Failed to move page. Please try again.');
      }
    },
    [draggedPage, movePage]
  );

  if (isLoading) {
    return (
      <div className="p-4 text-gray-500">
        <div className="animate-pulse">Loading pages...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>Error loading pages</p>
        <p className="text-sm">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  if (treeData.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-center">
        <p>No pages yet</p>
        <p className="text-sm mt-2">Create your first page to get started</p>
      </div>
    );
  }

  return (
    <div
      className="page-tree overflow-y-auto"
      role="tree"
      aria-label="Page tree navigation"
    >
      {treeData.map((page) => (
        <PageTreeItem
          key={page.guid}
          page={page}
          level={0}
          isActive={page.guid === activePageGuid}
          expandedGuids={expandedGuids}
          onSelect={onPageSelect}
          onContextMenu={onContextMenu}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onNewChild={onNewChild}
          onDrop={handleDrop}
          onToggleExpand={handleToggleExpand}
        />
      ))}
    </div>
  );
};
