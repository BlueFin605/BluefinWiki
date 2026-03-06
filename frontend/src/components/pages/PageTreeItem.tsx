/**
 * PageTreeItem Component
 * 
 * Displays a single page in the tree with expand/collapse functionality
 * and support for context menu and drag-and-drop
 */

import React, { useState } from 'react';
import { PageTreeNode } from '../../types/page';
import { usePageChildren } from '../../hooks/usePages';

interface PageTreeItemProps {
  page: PageTreeNode;
  level: number;
  isActive?: boolean;
  expandedGuids: Set<string>;
  onSelect: (guid: string) => void;
  onContextMenu: (event: React.MouseEvent, page: PageTreeNode) => void;
  onDragStart: (event: React.DragEvent, page: PageTreeNode) => void;
  onDragOver: (event: React.DragEvent, page: PageTreeNode) => void;
  onDrop: (event: React.DragEvent, page: PageTreeNode) => void;
  onToggleExpand: (guid: string) => void;
  onNewChild: (page: PageTreeNode) => void;
}

export const PageTreeItem: React.FC<PageTreeItemProps> = ({
  page,
  level,
  isActive = false,
  expandedGuids,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onToggleExpand,
  onNewChild,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  // Check if this page is expanded
  const isExpanded = expandedGuids.has(page.guid);

  // Fetch children when page is expanded
  const { data: children = [] } = usePageChildren(isExpanded ? page.guid : null);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
    onDragOver(event, page);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    onDrop(event, page);
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

  return (
    <div>
      <div
        className={`
          group flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 rounded
          ${isActive ? 'bg-blue-50 border-l-4 border-blue-600' : ''}
          ${isDragOver ? 'bg-blue-100 border-2 border-blue-400 border-dashed' : ''}
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
        {/* Expand/Collapse Icon */}
        {page.hasChildren && (
          <button
            className="mr-1 p-1 hover:bg-gray-200 rounded"
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
        )}

        {/* Page Icon */}
        <span className="mr-2">
          {page.hasChildren ? (
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

        {/* Add Child Page Button */}
        <button
          className="ml-1 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* Status Badge */}
        {page.status === 'draft' && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
            Draft
          </span>
        )}
        {page.status === 'archived' && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
            Archived
          </span>
        )}
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
