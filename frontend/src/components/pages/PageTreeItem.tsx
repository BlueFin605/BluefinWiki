/**
 * PageTreeItem Component
 *
 * Displays a single page in the tree with expand/collapse functionality
 * and support for context menu and drag-and-drop (both reparent and reorder)
 */

import React, { useState, useRef } from 'react';
import { PageTreeNode, PageTypeDefinition } from '../../types/page';
import { usePageChildren } from '../../hooks/usePages';

export type DropPosition = 'before' | 'after' | 'onto';

/** Check if dropping draggedPage onto targetPage violates type constraints. */
export function checkTypeConstraints(
  draggedPage: PageTreeNode,
  targetPage: PageTreeNode,
  pageTypesMap: Record<string, PageTypeDefinition>,
): string[] {
  const warnings: string[] = [];
  const parentType = targetPage.pageType ? pageTypesMap[targetPage.pageType] : null;
  const childType = draggedPage.pageType ? pageTypesMap[draggedPage.pageType] : null;

  // CHECK 1: Parent's perspective — does the parent allow this child type?
  if (parentType) {
    if (draggedPage.pageType) {
      if (parentType.allowedChildTypes.length > 0 &&
          !parentType.allowedChildTypes.includes(draggedPage.pageType)) {
        warnings.push(`${parentType.name} does not allow ${childType?.name || 'this type'} as a child`);
      }
    } else {
      if (!parentType.allowWikiPageChildren) {
        warnings.push(`${parentType.name} does not allow untyped wiki pages as children`);
      }
    }
  }

  // CHECK 2: Child's perspective — does the child allow this parent type?
  if (childType && childType.allowedParentTypes.length > 0) {
    if (targetPage.pageType) {
      if (!childType.allowedParentTypes.includes(targetPage.pageType)) {
        warnings.push(`${childType.name} cannot be placed under ${parentType?.name || 'this type'}`);
      }
    } else {
      if (!childType.allowAnyParent) {
        warnings.push(`${childType.name} cannot be placed under an untyped wiki page`);
      }
    }
  }

  return warnings;
}

interface PageTreeItemProps {
  page: PageTreeNode;
  level: number;
  isActive?: boolean;
  expandedGuids: Set<string>;
  pageTypesMap: Record<string, PageTypeDefinition>;
  draggedPage?: PageTreeNode | null;
  parentPageType?: string;  // pageType of this item's parent (for before/after constraint checks)
  onSelect: (guid: string) => void;
  onContextMenu: (event: React.MouseEvent, page: PageTreeNode) => void;
  onDragStart: (event: React.DragEvent, page: PageTreeNode) => void;
  onDragOver: (event: React.DragEvent, page: PageTreeNode) => void;
  onDrop: (event: React.DragEvent, page: PageTreeNode, position: DropPosition) => void;
  onToggleExpand: (guid: string) => void;
  onNewChild: (page: PageTreeNode) => void;
}

function getDropPosition(e: React.DragEvent, el: HTMLElement): DropPosition {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const threshold = rect.height * 0.25;
  if (y < threshold) return 'before';
  if (y > rect.height - threshold) return 'after';
  return 'onto';
}

export const PageTreeItem: React.FC<PageTreeItemProps> = ({
  page,
  level,
  isActive = false,
  expandedGuids,
  pageTypesMap,
  draggedPage,
  parentPageType,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onToggleExpand,
  onNewChild,
}) => {
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Check if this page is expanded
  const isExpanded = expandedGuids.has(page.guid);

  // Fetch children when page is expanded
  const { data: children = [] } = usePageChildren(isExpanded ? page.guid : null);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (rowRef.current) {
      const pos = getDropPosition(event, rowRef.current);
      setDropPosition(pos);

      // Set dropEffect based on type constraints
      if (draggedPage && draggedPage.guid !== page.guid) {
        let warnings: string[] = [];
        if (pos === 'onto') {
          warnings = checkTypeConstraints(draggedPage, page, pageTypesMap);
        } else if (draggedPage.parentGuid !== page.parentGuid) {
          const syntheticParent = { pageType: parentPageType } as PageTreeNode;
          warnings = checkTypeConstraints(draggedPage, syntheticParent, pageTypesMap);
        }
        event.dataTransfer.dropEffect = warnings.length > 0 ? 'none' : 'move';
      }
    }
    onDragOver(event, page);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only count as leave if we actually left this element
    if (rowRef.current && !rowRef.current.contains(e.relatedTarget as Node)) {
      setDropPosition(null);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const pos = rowRef.current ? getDropPosition(event, rowRef.current) : 'onto';
    setDropPosition(null);
    onDrop(event, page, pos);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      onSelect(page.guid);
    } else if (event.key === 'ArrowRight' && page.hasChildren && !isExpanded) {
      onToggleExpand(page.guid);
    } else if (event.key === 'ArrowLeft' && page.hasChildren && isExpanded) {
      onToggleExpand(page.guid);
    }
  };

  const paddingLeft = level * 16 + 8; // 16px per level + 8px base

  // Check type constraints during drag
  const typeWarnings = (() => {
    if (!draggedPage || draggedPage.guid === page.guid || !dropPosition) return [];
    if (dropPosition === 'onto') {
      return checkTypeConstraints(draggedPage, page, pageTypesMap);
    }
    // before/after with a different parent — check against this item's parent
    if (draggedPage.parentGuid !== page.parentGuid) {
      const syntheticParent = { pageType: parentPageType } as PageTreeNode;
      return checkTypeConstraints(draggedPage, syntheticParent, pageTypesMap);
    }
    return [];
  })();
  const hasTypeWarning = typeWarnings.length > 0;

  const dropIndicatorClass =
    dropPosition === 'before'
      ? hasTypeWarning
        ? 'border-t-2 border-amber-400'
        : 'border-t-2 border-blue-500'
      : dropPosition === 'after'
        ? hasTypeWarning
          ? 'border-b-2 border-amber-400'
          : 'border-b-2 border-blue-500'
        : dropPosition === 'onto'
          ? hasTypeWarning
            ? 'bg-amber-50 border-2 border-amber-400 border-dashed'
            : 'bg-blue-100 border-2 border-blue-400 border-dashed'
          : '';

  return (
    <div>
      <div
        ref={rowRef}
        className={`
          group flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 rounded
          ${isActive ? 'bg-blue-50 border-l-4 border-blue-600' : ''}
          ${dropIndicatorClass}
        `}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={() => onSelect(page.guid)}
        onContextMenu={(e) => onContextMenu(e, page)}
        onKeyDown={handleKeyDown}
        draggable
        onDragStart={(e) => onDragStart(e, page)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={0}
        role="treeitem"
        aria-selected={isActive}
        aria-expanded={page.hasChildren ? isExpanded : undefined}
      >
        {/* Expand/Collapse Icon (or spacer to keep alignment) */}
        {page.hasChildren ? (
          <button
            className="mr-1 p-1 hover:bg-gray-200 rounded-sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(page.guid);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : (
          <span className="mr-1 w-6 h-6 inline-block shrink-0" />
        )}

        {/* Page Icon — show type icon if page has a type, otherwise default */}
        <span className="mr-2 shrink-0">
          {page.pageType && pageTypesMap[page.pageType] ? (
            <span className="text-base leading-5" title={pageTypesMap[page.pageType].name}>
              {pageTypesMap[page.pageType].icon}
            </span>
          ) : page.hasChildren ? (
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>

        {/* Page Title */}
        <span className={`flex-1 truncate ${isActive ? 'font-semibold' : ''}`}>
          {page.title}
        </span>

        {/* Type constraint warning indicator */}
        {hasTypeWarning && dropPosition && (
          <span className="mr-1 text-amber-500 shrink-0" title={typeWarnings.join('\n')}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </span>
        )}

        {/* Add Child Page Button */}
        <button
          className="ml-1 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onNewChild(page);
          }}
          aria-label="Add child page"
          title="Create child page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>

      </div>

      {/* Render Children */}
      {isExpanded && children.length > 0 && (
        <div role="group">
          {children.map((child) => (
            <PageTreeItem
              key={child.guid}
              page={{
                ...child,
                children: [],
              }}
              level={level + 1}
              isActive={isActive}
              expandedGuids={expandedGuids}
              pageTypesMap={pageTypesMap}
              draggedPage={draggedPage}
              parentPageType={page.pageType}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onToggleExpand={onToggleExpand}
              onNewChild={onNewChild}
            />
          ))}
        </div>
      )}
    </div>
  );
};
