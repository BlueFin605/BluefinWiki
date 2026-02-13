import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import './markdown-preview.css';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Markdown preview component using react-markdown
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists, footnotes)
 * - Line breaks support (remark-breaks)
 * - Code syntax highlighting (rehype-highlight)
 * - Custom styling for readability
 * - Light/dark theme support
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
}) => {
  // Memoize the markdown rendering to avoid unnecessary re-renders
  const renderedContent = useMemo(() => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Customize link rendering to show warning in preview mode
          a: ({ node, children, href, ...props }) => (
            <a
              {...props}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                // In preview mode, links are disabled
                console.log('Links are disabled in preview mode');
              }}
              className="text-blue-600 dark:text-blue-400 underline cursor-not-allowed"
              title="Links are disabled in preview mode"
            >
              {children}
            </a>
          ),
          // Style headings
          h1: ({ node, children, ...props }) => (
            <h1 {...props} className="text-3xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100">
              {children}
            </h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 {...props} className="text-2xl font-bold mt-5 mb-3 text-gray-900 dark:text-gray-100">
              {children}
            </h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 {...props} className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">
              {children}
            </h3>
          ),
          h4: ({ node, children, ...props }) => (
            <h4 {...props} className="text-lg font-semibold mt-3 mb-2 text-gray-900 dark:text-gray-100">
              {children}
            </h4>
          ),
          h5: ({ node, children, ...props }) => (
            <h5 {...props} className="text-base font-semibold mt-2 mb-1 text-gray-900 dark:text-gray-100">
              {children}
            </h5>
          ),
          h6: ({ node, children, ...props }) => (
            <h6 {...props} className="text-sm font-semibold mt-2 mb-1 text-gray-900 dark:text-gray-100">
              {children}
            </h6>
          ),
          // Style paragraphs
          p: ({ node, children, ...props }) => (
            <p {...props} className="mb-4 text-gray-800 dark:text-gray-200 leading-relaxed">
              {children}
            </p>
          ),
          // Style lists (including task lists)
          ul: ({ node, children, ...props }) => {
            const isTaskList = (props as any).className?.includes('contains-task-list');
            return (
              <ul
                {...props}
                className={`mb-4 space-y-1 text-gray-800 dark:text-gray-200 ${
                  isTaskList ? 'list-none' : 'list-disc list-inside'
                }`}
              >
                {children}
              </ul>
            );
          },
          ol: ({ node, children, ...props }) => (
            <ol {...props} className="list-decimal list-inside mb-4 space-y-1 text-gray-800 dark:text-gray-200">
              {children}
            </ol>
          ),
          li: ({ node, children, ...props }) => {
            const isTaskItem = (props as any).className?.includes('task-list-item');
            return (
              <li
                {...props}
                className={`${isTaskItem ? 'flex items-start gap-2' : ''}`}
              >
                {children}
              </li>
            );
          },
          // Style code blocks (syntax highlighting handled by rehype-highlight)
          code: ({ node, className, children, ...props }) => {
            const inline = !className;
            return inline ? (
              <code
                {...props}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 rounded text-sm font-mono"
              >
                {children}
              </code>
            ) : (
              <pre className="my-4 rounded-md overflow-hidden">
                <code
                  {...props}
                  className={`${className || ''} block p-4 overflow-x-auto font-mono text-sm`}
                >
                  {children}
                </code>
              </pre>
            );
          },
          // Style blockquotes
          blockquote: ({ node, children, ...props }) => (
            <blockquote
              {...props}
              className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 mb-4 italic text-gray-700 dark:text-gray-300"
            >
              {children}
            </blockquote>
          ),
          // Style tables
          table: ({ node, children, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table {...props} className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            </div>
          ),
          thead: ({ node, children, ...props }) => (
            <thead {...props} className="bg-gray-100 dark:bg-gray-800">
              {children}
            </thead>
          ),
          th: ({ node, children, ...props }) => (
            <th {...props} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ node, children, ...props }) => (
            <td {...props} className="border border-gray-300 dark:border-gray-600 px-4 py-2">
              {children}
            </td>
          ),
          // Style horizontal rules
          hr: ({ node, ...props }) => (
            <hr {...props} className="my-6 border-t-2 border-gray-300 dark:border-gray-600" />
          ),
          // Style images
          img: ({ node, src, alt, ...props }) => (
            <img
              {...props}
              src={src}
              alt={alt}
              className="max-w-full h-auto rounded-md shadow-md my-4"
            />
          ),
        }}
      >
        {content || '*No content yet. Start writing...*'}
      </ReactMarkdown>
    );
  }, [content]);

  return (
    <div
      className={`markdown-preview h-full overflow-auto p-6 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md prose dark:prose-invert max-w-none ${className}`}
      data-testid="markdown-preview"
    >
      {renderedContent}
    </div>
  );
};

export default MarkdownPreview;
