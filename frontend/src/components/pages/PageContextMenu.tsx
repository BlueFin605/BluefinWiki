/**
 * PageContextMenu Component
 * 
 * Right-click context menu for page operations:
 * - Rename
 * - Delete
 * - Move
 * - New Child Page
 */

import React, { useEffect, useRef } from 'react';
import { PageTreeNode } from '../../types/page';

interface PageContextMenuProps {
  page: PageTreeNode | null;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: (page: PageTreeNode) => void;
  onDelete: (page: PageTreeNode) => void;
  onMove: (page: PageTreeNode) => void;
  onNewChild: (page: PageTreeNode) => void;
}

export const PageContextMenu: React.FC<PageContextMenuProps> = ({
  page,
  position,
  onClose,
  onRename,
  onDelete,
  onMove,
  onNewChild,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!page) return null;

  const menuItems = [
    {
      label: 'Rename',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
      onClick: () => {
        onRename(page);
        onClose();
      },
      shortcut: 'F2',
    },
    {
      label: 'New Child Page',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      onClick: () => {
        onNewChild(page);
        onClose();
      },
      shortcut: 'Ctrl+N',
    },
    {
      label: 'Move',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      ),
      onClick: () => {
        onMove(page);
        onClose();
      },
      shortcut: 'Ctrl+M',
    },
    {
      label: 'Delete',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
      onClick: () => {
        onDelete(page);
        onClose();
      },
      shortcut: 'Del',
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      role="menu"
      aria-label="Page actions"
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          className={`
            w-full text-left px-4 py-2 flex items-center justify-between
            hover:bg-gray-100 transition-colors
            ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}
          `}
          onClick={item.onClick}
          role="menuitem"
        >
          <span className="flex items-center gap-3">
            {item.icon}
            <span>{item.label}</span>
          </span>
          {item.shortcut && (
            <span className="text-xs text-gray-400 ml-4">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
};
