/**
 * PageTreeItem Component
 * 
 * Displays a single page in the tree with expand/collapse functionality
 * and support for context menu and drag-and-drop
 */

import React, { useState } from 'react';
import { PageTreeNode } from '../../types/page';

interface PageTreeItemProps {
  page: PageTreeNode;
  level: number;
  isActive?: boolean;
  onSelect: (guid: string) => void;
  onContextMenu: (event: React.MouseEvent, page: PageTreeNode) => void;
  onDragStart: (event: React.DragEvent, page: PageTreeNode) => void;
  onDragOver: (event: React.DragEvent, page: PageTreeNode) => void;
  onDrop: (event: React.DragEvent, page: PageTreeNode) => void;
  onToggleExpand: (guid: string) => void;
}

export const PageTreeItem: React.FC<PageTreeItemProps> = ({
  page,
  level,
  isActive = false,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onToggleExpand,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

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
    } else if (event.key === 'ArrowRight' && page.hasChildren && !page.isExpanded) {
      onToggleExpand(page.guid);
    } else if (event.key === 'ArrowLeft' && page.hasChildren && page.isExpanded) {
      onToggleExpand(page.guid);
    }
  };

  const paddingLeft = level * 16 + 8; // 16px per level + 8px base

  return (
    <div>
      <div
        className={`
          flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 rounded
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
        aria-expanded={page.hasChildren ? page.isExpanded : undefined}
      >
        {/* Expand/Collapse Icon */}
        {page.hasChildren && (
          <button
            className="mr-1 p-1 hover:bg-gray-200 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(page.guid);
            }}
            aria-label={page.isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${page.isExpanded ? 'rotate-90' : ''}`}
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
      {page.isExpanded && page.children && page.children.length > 0 && (
        <div role="group">
          {page.children.map((child) => (
            <PageTreeItem
              key={child.guid}
              page={child}
              level={level + 1}
              isActive={isActive}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};
