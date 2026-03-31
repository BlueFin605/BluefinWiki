import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMediaQuery, MOBILE } from '../../hooks/useMediaQuery';

interface TocHeading {
  level: number;
  text: string;
  id: string;
}

interface TableOfContentsProps {
  content: string;
}

/** Match the slugify function from MarkdownPreview */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/** Parse markdown content for h2-h6 headings */
function parseHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,6})\s+(.+)$/);
    if (match) {
      const text = match[2].replace(/[*_`~[\]]/g, '').trim();
      headings.push({
        level: match[1].length,
        text,
        id: slugify(text),
      });
    }
  }

  return headings;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ content }) => {
  const headings = parseHeadings(content);
  const isMobile = useMediaQuery(MOBILE);
  const [activeId, setActiveId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track active heading via IntersectionObserver
  useEffect(() => {
    if (headings.length < 3) return;

    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible heading
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    // Observe all heading elements
    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [headings]);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
      setActiveId(id);
    }
    if (isMobile) setIsOpen(false);
  }, [isMobile]);

  // Don't show if fewer than 3 headings
  if (headings.length < 3) return null;

  const minLevel = Math.min(...headings.map(h => h.level));

  const tocList = (
    <ul className="space-y-1">
      {headings.map((heading) => (
        <li
          key={heading.id}
          style={{ paddingLeft: `${(heading.level - minLevel) * 12}px` }}
        >
          <button
            onClick={() => handleClick(heading.id)}
            className={`block w-full text-left text-sm py-1 px-2 rounded transition-colors truncate ${
              activeId === heading.id
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={heading.text}
          >
            {heading.text}
          </button>
        </li>
      ))}
    </ul>
  );

  // Mobile: collapsible at top
  if (isMobile) {
    return (
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          On this page
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <div className="px-4 pb-3">
            {tocList}
          </div>
        )}
      </div>
    );
  }

  // Desktop: sticky sidebar
  return (
    <div className="w-56 shrink-0 sticky top-0 h-fit max-h-[calc(100vh-120px)] overflow-y-auto p-4">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        On this page
      </h4>
      {tocList}
    </div>
  );
};
