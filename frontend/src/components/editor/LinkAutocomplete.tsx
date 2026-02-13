/**
 * LinkAutocomplete Component
 * 
 * Provides autocomplete suggestions for wiki links when user types [[
 * Features:
 * - Triggered by [[ input in the editor
 * - Fuzzy search by page title
 * - Shows page hierarchy path for context
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Debounced search (200ms)
 * - Limited to 10 results
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePageSearch } from '../../hooks/usePages';

export interface LinkAutocompleteSuggestion {
  guid: string;
  title: string;
  path: string;
}

interface LinkAutocompleteProps {
  /** Search query text */
  query: string;
  /** Position to display the dropdown */
  position: { top: number; left: number };
  /** Callback when a suggestion is selected */
  onSelect: (suggestion: LinkAutocompleteSuggestion) => void;
  /** Callback when autocomplete should be closed */
  onClose: () => void;
  /** Whether the component is visible */
  visible: boolean;
}

/**
 * Debounce hook to delay search queries
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const LinkAutocomplete: React.FC<LinkAutocompleteProps> = ({
  query,
  position,
  onSelect,
  onClose,
  visible,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  // Debounce search query (200ms)
  const debouncedQuery = useDebounce(query, 200);
  
  // Fetch search results
  const { data: suggestions = [], isLoading } = usePageSearch(debouncedQuery, {
    enabled: visible && debouncedQuery.trim() !== '',
    limit: 10,
  });

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
    itemRefs.current = [];
  }, [suggestions]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            onSelect(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [visible, suggestions, selectedIndex, onSelect, onClose]
  );

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '300px',
        maxWidth: '500px',
      }}
    >
      {isLoading && (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          Searching...
        </div>
      )}

      {!isLoading && suggestions.length === 0 && query.trim() !== '' && (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          No pages found
        </div>
      )}

      {!isLoading && suggestions.length > 0 && (
        <ul className="py-1">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.guid}>
              <button
                ref={(el) => (itemRefs.current[index] = el)}
                type="button"
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : ''
                }`}
                onClick={() => onSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {suggestion.title}
                </div>
                {suggestion.path && suggestion.path !== suggestion.title && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {suggestion.path}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && suggestions.length === 0 && query.trim() === '' && (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          Start typing to search for pages
        </div>
      )}
    </div>
  );
};

export default LinkAutocomplete;
