import React, { useMemo, useCallback, useRef, useEffect, useState, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import remarkWikiLinks from '../../plugins/remarkWikiLinks';
import remarkImageSize from '../../plugins/remarkImageSize';
import apiClient from '../../config/api';
import './markdown-preview.css';

// Initialize mermaid with default config
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
});

/**
 * Component that renders a Mermaid diagram from source text.
 * Each instance gets a unique ID for mermaid's render call.
 */
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const id = useId().replace(/:/g, '_');

  useEffect(() => {
    let cancelled = false;

    const renderChart = async () => {
      try {
        // Detect dark mode and set mermaid theme accordingly
        const isDark = document.documentElement.classList.contains('dark');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDark ? 'dark' : 'default',
        });
        const { svg: renderedSvg } = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvg('');
        }
      }
    };

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="my-4 p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm overflow-x-auto">
        <code>{chart}</code>
        <div className="mt-2 text-xs">Mermaid error: {error}</div>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 p-4 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      className="my-4 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

/** Convert heading text to a URL-friendly slug (matches GitHub/GFM behaviour) */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // remove non-word chars (except spaces & hyphens)
    .replace(/\s+/g, '-');      // spaces → hyphens
}

/** Extract plain text from React children (handles nested elements) */
function childrenToText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string') return child;
      if (typeof child === 'number') return String(child);
      if (React.isValidElement(child) && child.props) {
        return childrenToText((child.props as { children?: React.ReactNode }).children);
      }
      return '';
    })
    .join('');
}

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onBrokenLinkClick?: (linkText: string, linkTarget: string) => void;
  /** Page GUID for resolving attachment references */
  pageGuid?: string;
  /** Callback when an image is resized via drag handle. Receives the image src (as written in markdown) and the new pixel width. */
  onImageResize?: (imageSrc: string, widthPx: number) => void;
}

// Type helper for react-markdown component props
type MarkdownComponentProps<T extends keyof React.JSX.IntrinsicElements> = React.ComponentPropsWithoutRef<T> & {
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
  width?: string;
  height?: string;
  [key: string]: unknown;
}> = ({ apiUrl, alt, fetchImageBlobUrl, width, height }) => {
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

  const sizeStyle: React.CSSProperties = {};
  if (width) sizeStyle.width = width;
  if (height) sizeStyle.height = height;

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={`${width ? '' : 'max-w-full'} h-auto rounded-md shadow-md my-4`}
      style={sizeStyle}
      onError={() => setError(true)}
      onLoad={() => console.log('✅ Image loaded:', apiUrl)}
    />
  );
};

/**
 * Wrapper that adds a bottom-right drag handle to an image for resizing.
 * On drag end it calls back with the new pixel width so the parent can
 * update the markdown source.
 */
const ResizableImage: React.FC<{
  children: React.ReactElement<React.ImgHTMLAttributes<HTMLImageElement>>;
  /** The original src as written in the markdown (bare filename or encoded path) */
  originalSrc: string;
  onResize?: (imageSrc: string, widthPx: number) => void;
}> = ({ children, originalSrc, onResize }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    startX.current = e.clientX;
    startWidth.current = container.getBoundingClientRect().width;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    const newWidth = Math.max(50, Math.round(startWidth.current + delta));
    setCurrentWidth(newWidth);
  }, [dragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (currentWidth && onResize) {
      onResize(originalSrc, currentWidth);
    }
  }, [dragging, currentWidth, onResize, originalSrc]);

  const widthStyle: React.CSSProperties = currentWidth
    ? { width: `${currentWidth}px` }
    : {};

  return (
    <div
      ref={containerRef}
      className={`relative inline-block my-4 group ${dragging ? 'select-none' : ''}`}
      style={widthStyle}
    >
      {React.cloneElement(children, {
        className: `${children.props.className || ''} ${currentWidth ? 'w-full' : ''}`.trim(),
        style: { ...children.props.style, ...(currentWidth ? { width: '100%', height: 'auto' } : {}) },
      } as React.ImgHTMLAttributes<HTMLImageElement>)}
      {onResize && (
        <div
          className={`absolute bottom-1 right-1 w-4 h-4 cursor-se-resize rounded-sm
            ${dragging ? 'bg-blue-500' : 'bg-gray-400/70 opacity-0 group-hover:opacity-100'}
            transition-opacity`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          title="Drag to resize"
        >
          <svg viewBox="0 0 16 16" className="w-full h-full text-white">
            <path d="M14 14H10M14 14V10M14 14L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
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
  onImageResize,
}) => {
  // Use a ref for the URL cache so the callback reference stays stable
  // and doesn't trigger useMemo/re-render cycles
  const imageUrlCache = useRef<Record<string, string>>({});
  // Maps transformed URL → original URI as written in the markdown (for resize callback)
  const transformedToOriginal = useRef<Record<string, string>>({});

  const fetchImageBlobUrl = useCallback(async (apiUrl: string): Promise<string> => {
    if (imageUrlCache.current[apiUrl]) {
      return imageUrlCache.current[apiUrl];
    }

    const response = await apiClient.get(apiUrl);
    const downloadUrl = response.data.url;
    imageUrlCache.current[apiUrl] = downloadUrl;
    return downloadUrl;
  }, []);
  // Transform attachment URLs from filename or pageGuid/filename format to full URLs
  const transformAttachmentUri = useCallback((uri: string) => {
    // Skip transformation for absolute URLs (http://, https://, etc.)
    if (/^[a-z][a-z0-9+.-]*:/i.test(uri)) {
      return uri;
    }

    // Skip transformation for anchor links (e.g. #heading-slug)
    if (uri.startsWith('#')) {
      return uri;
    }

    // Check if this is a bare filename (no slashes or protocol)
    // Use current pageGuid from context
    // The URI is already percent-encoded from the markdown source, so don't re-encode
    if (!uri.includes('/') && pageGuid) {
      const transformed = `/pages/${pageGuid}/attachments/${uri}`;
      transformedToOriginal.current[transformed] = uri;
      console.log(`🔄 Transformed bare filename:`, { original: uri, transformed });
      return transformed;
    }

    // Check if this is legacy pageGuid/filename format (backward compatibility)
    // GUID format: 8-4-4-4-12 hex characters
    const legacyPattern = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(.+)$/i;
    const match = uri.match(legacyPattern);

    if (match) {
      const [, guid, filename] = match;
      const transformed = `/pages/${guid}/attachments/${filename}`;
      transformedToOriginal.current[transformed] = uri;
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
        remarkPlugins={[remarkGfm, remarkBreaks, remarkWikiLinks, remarkImageSize]}
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
            
            // Anchor link — scroll to heading within the preview
            if (href?.startsWith('#')) {
              return (
                <a
                  {...props}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    const targetId = href.slice(1);
                    const el = document.getElementById(targetId);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
                >
                  {children}
                </a>
              );
            }

            // External link — open in new tab
            return (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
              >
                {children}
              </a>
            );
          },
          // Style headings (with id slugs for anchor links)
          h1: ({ children, ...props }: MarkdownComponentProps<'h1'>) => (
            <h1 {...props} id={slugify(childrenToText(children))} className="text-3xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100">
              {children}
            </h1>
          ),
          h2: ({ children, ...props }: MarkdownComponentProps<'h2'>) => (
            <h2 {...props} id={slugify(childrenToText(children))} className="text-2xl font-bold mt-5 mb-3 text-gray-900 dark:text-gray-100">
              {children}
            </h2>
          ),
          h3: ({ children, ...props }: MarkdownComponentProps<'h3'>) => (
            <h3 {...props} id={slugify(childrenToText(children))} className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">
              {children}
            </h3>
          ),
          h4: ({ children, ...props }: MarkdownComponentProps<'h4'>) => (
            <h4 {...props} id={slugify(childrenToText(children))} className="text-lg font-semibold mt-3 mb-2 text-gray-900 dark:text-gray-100">
              {children}
            </h4>
          ),
          h5: ({ children, ...props }: MarkdownComponentProps<'h5'>) => (
            <h5 {...props} id={slugify(childrenToText(children))} className="text-base font-semibold mt-2 mb-1 text-gray-900 dark:text-gray-100">
              {children}
            </h5>
          ),
          h6: ({ children, ...props }: MarkdownComponentProps<'h6'>) => (
            <h6 {...props} id={slugify(childrenToText(children))} className="text-sm font-semibold mt-2 mb-1 text-gray-900 dark:text-gray-100">
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
          // Skip <pre> wrapper for mermaid diagrams (MermaidDiagram handles its own container)
          pre: ({ children }: MarkdownComponentProps<'pre'>) => {
            // Check if the child is a mermaid code block
            const child = React.Children.toArray(children)[0];
            if (React.isValidElement(child) && (child.props as Record<string, unknown>).className?.toString().includes('language-mermaid')) {
              return <>{children}</>;
            }
            return <>{children}</>;
          },
          // Style code blocks (syntax highlighting handled by rehype-highlight)
          // Mermaid code blocks are rendered as interactive diagrams
          code: ({ className, children, ...props }: MarkdownComponentProps<'code'>) => {
            const inline = !className;
            const isMermaid = className?.includes('language-mermaid');

            if (isMermaid) {
              const chart = String(children).replace(/\n$/, '');
              return <MermaidDiagram chart={chart} />;
            }

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
          // Style images (with optional size from remarkImageSize plugin + drag-to-resize)
          img: ({ src, alt, width, height, ...props }: MarkdownComponentProps<'img'>) => {
            const imgWidth = typeof width === 'string' ? width : width ? `${width}px` : undefined;
            const imgHeight = typeof height === 'string' ? height : height ? `${height}px` : undefined;
            const sizeStyle: React.CSSProperties = {};
            if (imgWidth) sizeStyle.width = imgWidth;
            if (imgHeight) sizeStyle.height = imgHeight;

            // Resolve the original src for the resize callback
            const originalSrc = (src && transformedToOriginal.current[src]) || src || '';

            // Check if this is an API URL (starts with /pages/)
            const isApiUrl = src?.startsWith('/pages/');

            let imgEl: React.ReactElement<React.ImgHTMLAttributes<HTMLImageElement>>;
            if (isApiUrl && src) {
              imgEl = <AsyncImage apiUrl={src} alt={alt} fetchImageBlobUrl={fetchImageBlobUrl} width={imgWidth} height={imgHeight} {...props} />;
            } else {
              imgEl = (
                <img
                  {...props}
                  src={src}
                  alt={alt}
                  className={`${imgWidth ? '' : 'max-w-full'} h-auto rounded-md shadow-md`}
                  style={sizeStyle}
                  onError={(e) => console.error('❌ External image failed to load:', src, e)}
                />
              );
            }

            return (
              <ResizableImage originalSrc={originalSrc} onResize={onImageResize}>
                {imgEl}
              </ResizableImage>
            );
          },
        }}
      >
        {content || '*No content yet. Start writing...*'}
      </ReactMarkdown>
    );
  }, [content, transformAttachmentUri, onBrokenLinkClick, fetchImageBlobUrl, onImageResize]);


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
