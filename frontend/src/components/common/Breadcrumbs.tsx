import React from 'react';
import { usePageAncestors } from '../../hooks/usePages';
import { useMediaQuery, MOBILE } from '../../hooks/useMediaQuery';

interface BreadcrumbsProps {
  pageGuid: string;
  pageTitle: string;
  onNavigate: (guid: string) => void;
  onNavigateHome: () => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  pageGuid,
  pageTitle,
  onNavigate,
  onNavigateHome,
}) => {
  const { data: ancestors = [] } = usePageAncestors(pageGuid);
  const isMobile = useMediaQuery(MOBILE);

  // Build segments: Home + ancestors + current page
  const segments = [
    { guid: null, title: 'Home' },
    ...ancestors.map(a => ({ guid: a.guid, title: a.title })),
    { guid: pageGuid, title: pageTitle },
  ];

  // On mobile, collapse middle segments if more than 3
  const displaySegments = isMobile && segments.length > 3
    ? [segments[0], { guid: null, title: '\u2026', collapsed: true }, segments[segments.length - 1]]
    : segments;

  return (
    <nav aria-label="Breadcrumb" className="px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
      <ol className="flex items-center gap-1 min-w-0">
        {displaySegments.map((segment, index) => {
          const isLast = index === displaySegments.length - 1;
          const isCollapsed = (segment as { collapsed?: boolean }).collapsed;

          return (
            <li key={segment.guid ?? `seg-${index}`} className="flex items-center gap-1 min-w-0">
              {index > 0 && (
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {isLast || isCollapsed ? (
                <span
                  className={`truncate max-w-[200px] ${
                    isLast
                      ? 'text-gray-900 dark:text-gray-100 font-medium'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                  title={segment.title}
                >
                  {segment.title}
                </span>
              ) : (
                <button
                  onClick={() => segment.guid ? onNavigate(segment.guid) : onNavigateHome()}
                  className="truncate max-w-[200px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                  title={segment.title}
                >
                  {segment.title}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
