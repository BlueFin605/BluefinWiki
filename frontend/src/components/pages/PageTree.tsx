/**
 * PageTree Component
 *
 * Displays a hierarchical tree of pages with support for:
 * - Recursive rendering of nested pages
 * - Expand/collapse functionality
 * - Context menu for page operations
 * - Drag-and-drop to move pages (reparent) and reorder siblings
 * - Keyboard navigation
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageTreeItem, DropPosition, checkTypeConstraints } from './PageTreeItem';
import { PageTreeNode, PageTypeDefinition } from '../../types/page';
import { usePageChildren, useMovePage, useReorderPages } from '../../hooks/usePages';
import { usePageTypes } from '../../hooks/usePageTypes';

interface PageTreeProps {
  activePageGuid?: string;
  onPageSelect: (guid: string) => void;
  onContextMenu: (event: React.MouseEvent, page: PageTreeNode) => void;
  onNewChild: (page: PageTreeNode) => void;
  onPageMoved?: () => void;
  /** GUIDs to ensure are expanded (e.g. parent of a newly created page) */
  ensureExpanded?: string[];
}

export const PageTree: React.FC<PageTreeProps> = ({
  activePageGuid,
  onPageSelect,
  onContextMenu,
  onNewChild,
  onPageMoved,
  ensureExpanded,
}) => {
  const [expandedGuids, setExpandedGuids] = useState<Set<string>>(new Set());

  // Expand nodes requested by parent (e.g. after creating a child page)
  React.useEffect(() => {
    if (ensureExpanded && ensureExpanded.length > 0) {
      setExpandedGuids(prev => {
        const next = new Set(prev);
        for (const guid of ensureExpanded) next.add(guid);
        return next;
      });
    }
  }, [ensureExpanded]);
  const [draggedPage, setDraggedPage] = useState<PageTreeNode | null>(null);

  // Fetch root-level pages
  const { data: rootPages = [], isLoading, error } = usePageChildren(null);
  const { data: pageTypesList = [] } = usePageTypes();

  // Build page types lookup map
  const pageTypesMap = useMemo(() => {
    const map: Record<string, PageTypeDefinition> = {};
    for (const pt of pageTypesList) map[pt.guid] = pt;
    return map;
  }, [pageTypesList]);

  // Move page mutation
  const movePage = useMovePage(draggedPage?.guid || '');
  const reorderPages = useReorderPages();
  const queryClient = useQueryClient();

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

      // dropEffect is set by PageTreeItem.handleDragOver which has full context
    },
    [draggedPage]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent, targetPage: PageTreeNode, position: DropPosition) => {
      event.preventDefault();

      if (!draggedPage) return;
      if (draggedPage.guid === targetPage.guid) return;

      // For reparent (onto) operations, block if type constraints are violated
      if (position === 'onto') {
        const warnings = checkTypeConstraints(draggedPage, targetPage, pageTypesMap);
        if (warnings.length > 0) {
          window.alert(`Cannot move here:\n\n${warnings.join('\n')}`);
          setDraggedPage(null);
          return;
        }
      }

      const sameParent = draggedPage.parentGuid === targetPage.parentGuid;

      if ((position === 'before' || position === 'after') && sameParent) {
        // Reorder: the dragged page and target share the same parent
        // We need the full sibling list for the shared parent
        const parentGuid = targetPage.parentGuid;
        const siblings = parentGuid === null ? rootPages : [];

        // For non-root siblings we need to get from cache or refetch
        // Use rootPages for root level, otherwise we'll build from what we know
        let siblingGuids: string[];
        if (parentGuid === null) {
          siblingGuids = siblings.map(s => s.guid);
        } else {
          const { apiClient } = await import('../../config/api');
          const resp = await apiClient.get(`/pages/${parentGuid}/children`);
          const childrenData = resp.data.children || [];
          siblingGuids = childrenData.map((c: { guid: string }) => c.guid);
        }

        // Remove dragged from current position and insert at new position
        const filtered = siblingGuids.filter(g => g !== draggedPage.guid);
        const targetIndex = filtered.indexOf(targetPage.guid);
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        filtered.splice(insertIndex, 0, draggedPage.guid);

        try {
          await reorderPages.mutateAsync({
            parentGuid: parentGuid,
            orderedGuids: filtered,
          });
          queryClient.invalidateQueries({ queryKey: ['pages', 'children'] });
          setDraggedPage(null);
          onPageMoved?.();
        } catch (error) {
          console.error('Failed to reorder pages:', error);
        }
      } else if (position === 'onto') {
        // Reparent: move dragged page into target page
        try {
          await movePage.mutateAsync({
            newParentGuid: targetPage.guid,
          });
          setDraggedPage(null);
          onPageMoved?.();
        } catch (error) {
          console.error('Failed to move page:', error);
        }
      } else {
        // before/after but different parent — move to target's parent first,
        // then reorder (two operations)
        try {
          const targetParent = targetPage.parentGuid;

          // Check type constraints against the target's parent before moving
          if (targetParent !== null) {
            const { apiClient } = await import('../../config/api');
            const parentResp = await apiClient.get(`/pages/${targetParent}`);
            const parentPageType = parentResp.data?.pageType;
            const syntheticParent = { pageType: parentPageType } as PageTreeNode;
            const warnings = checkTypeConstraints(draggedPage, syntheticParent, pageTypesMap);
            if (warnings.length > 0) {
              window.alert(`Cannot move here:\n\n${warnings.join('\n')}`);
              setDraggedPage(null);
              return;
            }
          }

          // First move to the same parent
          await movePage.mutateAsync({
            newParentGuid: targetParent,
          });

          // Then reorder among the new siblings
          const { apiClient } = await import('../../config/api');
          const path = targetParent ? `/pages/${targetParent}/children` : '/pages/root/children';
          const resp = await apiClient.get(path);
          const newSiblings: string[] = (resp.data.children || []).map((c: { guid: string }) => c.guid);

          const filtered = newSiblings.filter(g => g !== draggedPage.guid);
          const targetIndex = filtered.indexOf(targetPage.guid);
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          filtered.splice(insertIndex, 0, draggedPage.guid);

          await reorderPages.mutateAsync({
            parentGuid: targetParent,
            orderedGuids: filtered,
          });

          queryClient.invalidateQueries({ queryKey: ['pages', 'children'] });
          setDraggedPage(null);
          onPageMoved?.();
        } catch (error) {
          console.error('Failed to move and reorder page:', error);
        }
      }
    },
    [draggedPage, movePage, reorderPages, rootPages, onPageMoved]
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
          pageTypesMap={pageTypesMap}
          draggedPage={draggedPage}
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
