import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import remarkWikiLinks from '../../plugins/remarkWikiLinks';
import apiClient from '../../config/api';
import './markdown-preview.css';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onBrokenLinkClick?: (linkText: string, linkTarget: string) => void;
  /** Page GUID for resolving attachment references */
  pageGuid?: string;
}

// Type helper for react-markdown component props
type MarkdownComponentProps<T extends keyof JSX.IntrinsicElements> = React.ComponentPropsWithoutRef<T> & {
  node?: unknown;
};

/**
 * Component for rendering images from API endpoints
 * Fetches the image via axios (with auth) and converts to blob URL
 */
const AsyncImage: React.FC<{
  apiUrl: string;
  alt?: string;
  fetchImageBlobUrl: (url: string) => Promise<string>;
  [key: string]: unknown;
}> = ({ apiUrl, alt, fetchImageBlobUrl, ...props }) => {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      try {
        const url = await fetchImageBlobUrl(apiUrl);
        if (!cancelled) {
          setBlobUrl(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(true);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, fetchImageBlobUrl]);

  if (error) {
    return (
      <div className="max-w-full h-24 rounded-md shadow-md my-4 bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-red-400">
        <span className="text-sm text-red-600 dark:text-red-400">Failed to load image</span>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="max-w-full h-24 rounded-md shadow-md my-4 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading image...</span>
      </div>
    );
  }

  return (
    <img
      {...props}
      src={blobUrl}
      alt={alt}
      className="max-w-full h-auto rounded-md shadow-md my-4"
      onError={() => {
        setError(true);
        console.error('❌ Image blob failed to render:', apiUrl);
      }}
      onLoad={() => console.log('✅ Image blob loaded:', apiUrl)}
    />
  );
};

/**
 * Markdown preview component using react-markdown
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists, footnotes)
 * - Line breaks support (remark-breaks)
 * - Code syntax highlighting (rehype-highlight)
 * - Wiki-style links ([[Page Title]] and [[guid|Display Text]])
 * - Custom styling for readability
 * - Light/dark theme support
 * - Broken link detection and creation workflow
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
  onBrokenLinkClick,
  pageGuid,
}) => {
  const [imageBlobUrls, setImageBlobUrls] = useState<Record<string, string>>({});
  const blobUrlRegistry = useRef<Set<string>>(new Set());

  // Fetch image via axios and convert to blob URL
  const fetchImageBlobUrl = useCallback(async (apiUrl: string): Promise<string> => {
    if (imageBlobUrls[apiUrl]) {
      return imageBlobUrls[apiUrl];
    }

    try {
      console.log(`🔄 Fetching image blob: ${apiUrl}`);
      const response = await apiClient.get(apiUrl, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      blobUrlRegistry.current.add(blobUrl);
      console.log(`✅ Created blob URL: ${blobUrl.substring(0, 50)}...`);
      setImageBlobUrls((prev) => ({ ...prev, [apiUrl]: blobUrl }));
      return blobUrl;
    } catch (err) {
      console.error(`❌ Failed to fetch image: ${apiUrl}`, err);
      throw err;
    }
  }, [imageBlobUrls]);
  // Transform attachment URLs from filename or pageGuid/filename format to full URLs
  const transformAttachmentUri = useCallback((uri: string) => {
    // Skip transformation for absolute URLs (http://, https://, etc.)
    if (/^[a-z][a-z0-9+.-]*:/i.test(uri)) {
      return uri;
    }

    // Check if this is a bare filename (no slashes or protocol)
    // Use current pageGuid from context
    if (!uri.includes('/') && pageGuid) {
      const transformed = `/pages/${pageGuid}/attachments/${encodeURIComponent(uri)}`;
      console.log(`🔄 Transformed bare filename:`, { original: uri, transformed });
      return transformed;
    }

    // Check if this is legacy pageGuid/filename format (backward compatibility)
    // GUID format: 8-4-4-4-12 hex characters
    const legacyPattern = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(.+)$/i;
    const match = uri.match(legacyPattern);
    
    if (match) {
      const [, guid, filename] = match;
      const transformed = `/pages/${guid}/attachments/${encodeURIComponent(filename)}`;
      console.log(`🔄 Transformed legacy attachment URI:`, { original: uri, transformed });
      return transformed;
    }
    
    // Not an attachment reference, return as-is
    console.log(`⏭️ URI not an attachment:`, uri);
    return uri;
  }, [pageGuid]);

  // Memoize the markdown rendering to avoid unnecessary re-renders
  const renderedContent = useMemo(() => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkWikiLinks]}
        rehypePlugins={[rehypeHighlight]}
        urlTransform={transformAttachmentUri}
        components={{
          // Customize link rendering to handle both wiki links and external links
          a: ({ children, href, ...props }: MarkdownComponentProps<'a'>) => {
            // Check if this is a wiki link by looking at data attributes
            const dataProps = props as Record<string, unknown>;
            const isWikiLink = dataProps['data-wiki-link'] === 'true';
            const isBroken = dataProps['data-broken'] === 'true';
            const wikiTarget = dataProps['data-wiki-target'] as string | undefined;
            
            if (isWikiLink) {
              // Wiki link styling
              const baseClasses = 'underline cursor-pointer';
              const colorClasses = isBroken
                ? 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300';
              
              return (
                <a
                  {...props}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    if (isBroken && onBrokenLinkClick) {
                      // Extract link text from children
                      const linkText = typeof children === 'string' 
                        ? children 
                        : Array.isArray(children) 
                          ? children.join('') 
                          : wikiTarget || 'Untitled';
                      onBrokenLinkClick(linkText, wikiTarget || linkText);
                    } else {
                      // In preview mode, wiki links are disabled
                      console.log('Wiki link clicked (disabled in preview):', href);
                    }
                  }}
                  className={`${baseClasses} ${colorClasses}`}
                  title={isBroken ? `Page not found: ${wikiTarget}. Click to create.` : undefined}
                >
                  {children}
                  {isBroken && <span className="ml-1 text-xs">?</span>}
                </a>
              );
            }
            
            // External link styling
            return (
              <a
                {...props}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  // In preview mode, links are disabled
                  console.log('External link clicked (disabled in preview):', href);
                }}
                className="text-blue-600 dark:text-blue-400 underline cursor-not-allowed"
                title="Links are disabled in preview mode"
              >
                {children}
              </a>
            );
          },
          // Style headings
          h1: ({ children, ...props }: MarkdownComponentProps<'h1'>) => (
            <h1 {...props} className="text-3xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100">
              {children}
            </h1>
          ),
          h2: ({ children, ...props }: MarkdownComponentProps<'h2'>) => (
            <h2 {...props} className="text-2xl font-bold mt-5 mb-3 text-gray-900 dark:text-gray-100">
              {children}
            </h2>
          ),
          h3: ({ children, ...props }: MarkdownComponentProps<'h3'>) => (
            <h3 {...props} className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">
              {children}
            </h3>
          ),
          h4: ({ children, ...props }: MarkdownComponentProps<'h4'>) => (
            <h4 {...props} className="text-lg font-semibold mt-3 mb-2 text-gray-900 dark:text-gray-100">
              {children}
            </h4>
          ),
          h5: ({ children, ...props }: MarkdownComponentProps<'h5'>) => (
            <h5 {...props} className="text-base font-semibold mt-2 mb-1 text-gray-900 dark:text-gray-100">
              {children}
            </h5>
          ),
          h6: ({ children, ...props }: MarkdownComponentProps<'h6'>) => (
            <h6 {...props} className="text-sm font-semibold mt-2 mb-1 text-gray-900 dark:text-gray-100">
              {children}
            </h6>
          ),
          // Style paragraphs
          p: ({ children, ...props }: MarkdownComponentProps<'p'>) => (
            <p {...props} className="mb-4 text-gray-800 dark:text-gray-200 leading-relaxed">
              {children}
            </p>
          ),
          // Style lists (including task lists)
          ul: ({ children, ...props }: MarkdownComponentProps<'ul'>) => {
            const isTaskList = props.className?.includes('contains-task-list');
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
          ol: ({ children, ...props }: MarkdownComponentProps<'ol'>) => (
            <ol {...props} className="list-decimal list-inside mb-4 space-y-1 text-gray-800 dark:text-gray-200">
              {children}
            </ol>
          ),
          li: ({ children, ...props }: MarkdownComponentProps<'li'>) => {
            const isTaskItem = props.className?.includes('task-list-item');
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
          code: ({ className, children, ...props }: MarkdownComponentProps<'code'>) => {
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
          blockquote: ({ children, ...props }: MarkdownComponentProps<'blockquote'>) => (
            <blockquote
              {...props}
              className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 mb-4 italic text-gray-700 dark:text-gray-300"
            >
              {children}
            </blockquote>
          ),
          // Style tables
          table: ({ children, ...props }: MarkdownComponentProps<'table'>) => (
            <div className="overflow-x-auto mb-4">
              <table {...props} className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }: MarkdownComponentProps<'thead'>) => (
            <thead {...props} className="bg-gray-100 dark:bg-gray-800">
              {children}
            </thead>
          ),
          th: ({ children, ...props }: MarkdownComponentProps<'th'>) => (
            <th {...props} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children, ...props }: MarkdownComponentProps<'td'>) => (
            <td {...props} className="border border-gray-300 dark:border-gray-600 px-4 py-2">
              {children}
            </td>
          ),
          // Style horizontal rules
          hr: (props: MarkdownComponentProps<'hr'>) => (
            <hr {...props} className="my-6 border-t-2 border-gray-300 dark:border-gray-600" />
          ),
          // Style images
          img: ({ src, alt, ...props }: MarkdownComponentProps<'img'>) => {
            // Check if this is an API URL (starts with /pages/)
            const isApiUrl = src?.startsWith('/pages/');
            
            if (isApiUrl && src) {
              // Return a component that fetches the image via axios
              return <AsyncImage apiUrl={src} alt={alt} fetchImageBlobUrl={fetchImageBlobUrl} {...props} />;
            }
            
            // For external URLs, render directly
            console.log(`🖼️ Rendering external image:`, { src, alt });
            return (
              <img
                {...props}
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded-md shadow-md my-4"
                onError={(e) => console.error('❌ External image failed to load:', src, e)}
                onLoad={() => console.log('✅ External image loaded:', src)}
              />
            );
          },
        }}
      >
        {content || '*No content yet. Start writing...*'}
      </ReactMarkdown>
    );
  }, [content, transformAttachmentUri, onBrokenLinkClick, fetchImageBlobUrl]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of blobUrlRegistry.current) {
        URL.revokeObjectURL(url);
      }
      blobUrlRegistry.current.clear();
    };
  }, []);

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
