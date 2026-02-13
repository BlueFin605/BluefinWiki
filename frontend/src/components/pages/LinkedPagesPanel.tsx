/**
 * LinkedPagesPanel Component
 * 
 * Displays a sidebar widget showing pages that link to the current page (backlinks).
 * Features:
 * - Show backlinks count
 * - Display list of linking pages with titles
 * - Navigate to linking page on click
 * - Loading states and empty states
 */

import React from 'react';
import { Backlink } from '../../hooks/usePages';

interface LinkedPagesPanelProps {
  pageGuid: string;
  backlinks: Backlink[];
  isLoading: boolean;
  onPageClick: (guid: string) => void;
}

export const LinkedPagesPanel: React.FC<LinkedPagesPanelProps> = ({
  backlinks,
  isLoading,
  onPageClick,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Linked Pages
          </h3>
          {!isLoading && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {backlinks.length}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : backlinks.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No pages link to this page</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {backlinks.map((backlink) => (
              <li key={backlink.guid}>
                <button
                  onClick={() => onPageClick(backlink.guid)}
                  className="w-full text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                  title={`Navigate to ${backlink.title}`}
                >
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 mt-0.5 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0"
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {backlink.title}
                      </p>
                      {backlink.linkText && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          via: {backlink.linkText}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LinkedPagesPanel;
