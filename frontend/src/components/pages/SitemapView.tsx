import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../config/api';
import { PageSummary } from '../../types/page';

interface SitemapNode extends PageSummary {
  children?: SitemapNode[];
}

function useSitemap() {
  return useQuery({
    queryKey: ['sitemap'],
    queryFn: async (): Promise<SitemapNode[]> => {
      const response = await apiClient.get('/api/sitemap');
      return response.data.pages || [];
    },
  });
}

interface TreeNodeProps {
  node: SitemapNode;
  onNavigate: (guid: string) => void;
  filterText: string;
  level: number;
  defaultExpanded: boolean;
}

function matchesFilter(node: SitemapNode, text: string): boolean {
  if (node.title.toLowerCase().includes(text)) return true;
  return (node.children ?? []).some(child => matchesFilter(child, text));
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, onNavigate, filterText, level, defaultExpanded }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isMatch = filterText && node.title.toLowerCase().includes(filterText);

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 group"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Icon */}
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {hasChildren ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          )}
        </svg>

        <button
          onClick={() => onNavigate(node.guid)}
          className={`text-sm truncate hover:underline ${
            isMatch
              ? 'text-blue-600 dark:text-blue-400 font-semibold bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded'
              : 'text-gray-800 dark:text-gray-200'
          }`}
          title={node.title}
        >
          {node.title}
        </button>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children!.map(child => (
            <TreeNode
              key={child.guid}
              node={child}
              onNavigate={onNavigate}
              filterText={filterText}
              level={level + 1}
              defaultExpanded={!!filterText && matchesFilter(child, filterText)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SitemapView: React.FC = () => {
  const navigate = useNavigate();
  const { data: pages = [], isLoading, error } = useSitemap();
  const [filter, setFilter] = useState('');

  const filterLower = filter.toLowerCase().trim();

  const filteredPages = useMemo(() => {
    if (!filterLower) return pages;
    return pages.filter(page => matchesFilter(page, filterLower));
  }, [pages, filterLower]);

  const handleNavigate = useCallback((guid: string) => {
    navigate(`/pages/${guid}`);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sitemap</h1>
          <button
            onClick={() => navigate('/pages')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Pages
          </button>
        </div>

        {/* Filter input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Filter pages..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Tree */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          {isLoading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading sitemap...</div>
          )}
          {error && (
            <div className="text-center py-8 text-red-500">Failed to load sitemap.</div>
          )}
          {!isLoading && !error && filteredPages.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {filter ? 'No pages match your filter.' : 'No pages yet.'}
            </div>
          )}
          {filteredPages.map(page => (
            <TreeNode
              key={page.guid}
              node={page}
              onNavigate={handleNavigate}
              filterText={filterLower}
              level={0}
              defaultExpanded={!!filterLower && matchesFilter(page, filterLower)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
