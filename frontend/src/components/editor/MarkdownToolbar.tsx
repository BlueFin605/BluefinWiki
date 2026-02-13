import React from 'react';

interface MarkdownToolbarProps {
  onAction: (action: ToolbarAction, value?: string) => void;
  disabled?: boolean;
}

export type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'ul'
  | 'ol'
  | 'task'
  | 'link'
  | 'image'
  | 'code'
  | 'codeblock';

/**
 * Markdown toolbar with formatting buttons
 * Features:
 * - Text formatting: bold, italic, strikethrough
 * - Headers: H1-H6
 * - Lists: unordered, ordered, task lists
 * - Links, images, code blocks
 */
export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  onAction,
  disabled = false,
}) => {
  const [showHeaderMenu, setShowHeaderMenu] = React.useState(false);
  const headerMenuRef = React.useRef<HTMLDivElement>(null);

  // Close header menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const buttonClass = `
    p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors
  `;

  const iconClass = 'w-5 h-5';

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
      {/* Text formatting */}
      <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-1">
        <button
          onClick={() => onAction('bold')}
          disabled={disabled}
          className={buttonClass}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4zm0 8h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z" />
          </svg>
        </button>

        <button
          onClick={() => onAction('italic')}
          disabled={disabled}
          className={buttonClass}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h8M6 20h8m-4-16l-4 16" />
          </svg>
        </button>

        <button
          onClick={() => onAction('strikethrough')}
          disabled={disabled}
          className={buttonClass}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M8 5h8M9 19h6" />
          </svg>
        </button>
      </div>

      {/* Headers */}
      <div className="relative flex items-center border-r border-gray-300 dark:border-gray-600 pr-2 mr-1">
        <button
          onClick={() => setShowHeaderMenu(!showHeaderMenu)}
          disabled={disabled}
          className={buttonClass}
          title="Heading"
          aria-label="Heading dropdown"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>

        {showHeaderMenu && (
          <div
            ref={headerMenuRef}
            className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-10 min-w-[120px]"
          >
            {(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((header) => (
              <button
                key={header}
                onClick={() => {
                  onAction(header);
                  setShowHeaderMenu(false);
                }}
                disabled={disabled}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t last:rounded-b"
              >
                <span className="font-semibold">{header.toUpperCase()}</span>
                <span className="text-gray-500 ml-2">Heading {header.charAt(1)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lists */}
      <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-1">
        <button
          onClick={() => onAction('ul')}
          disabled={disabled}
          className={buttonClass}
          title="Unordered list"
          aria-label="Unordered list"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <button
          onClick={() => onAction('ol')}
          disabled={disabled}
          className={buttonClass}
          title="Ordered list"
          aria-label="Ordered list"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h12M9 12h12M9 19h12M5 5v2m0 5v2m0 5v2" />
          </svg>
        </button>

        <button
          onClick={() => onAction('task')}
          disabled={disabled}
          className={buttonClass}
          title="Task list"
          aria-label="Task list"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>
      </div>

      {/* Links and media */}
      <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-1">
        <button
          onClick={() => onAction('link')}
          disabled={disabled}
          className={buttonClass}
          title="Insert link"
          aria-label="Insert link"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>

        <button
          onClick={() => onAction('image')}
          disabled={disabled}
          className={buttonClass}
          title="Insert image"
          aria-label="Insert image"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* Code */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onAction('code')}
          disabled={disabled}
          className={buttonClass}
          title="Inline code"
          aria-label="Inline code"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </button>

        <button
          onClick={() => onAction('codeblock')}
          disabled={disabled}
          className={buttonClass}
          title="Code block"
          aria-label="Code block"
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MarkdownToolbar;
