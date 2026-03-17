/**
 * Unit Tests for SearchDialog Component
 * Task 8.3: Search dialog UI, keyboard nav, accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchDialog } from '../SearchDialog';

// Mock the useSearch hook
const mockSetQuery = vi.fn();
const mockLoadMore = vi.fn();
const mockSetScope = vi.fn();
const mockSetTitleOnly = vi.fn();
const mockSetPageSize = vi.fn();

const defaultUseSearchReturn = {
  query: '',
  setQuery: mockSetQuery,
  results: [],
  totalResults: 0,
  isSearching: false,
  executionTimeMs: 0,
  error: null,
  hasMore: false,
  loadMore: mockLoadMore,
  pageSize: 10,
  setPageSize: mockSetPageSize,
  scope: 'all',
  setScope: mockSetScope,
  titleOnly: false,
  setTitleOnly: mockSetTitleOnly,
  isIndexLoaded: true,
};

let useSearchReturnValue = { ...defaultUseSearchReturn };

vi.mock('../../../hooks/useSearch', () => ({
  useSearch: () => useSearchReturnValue,
}));

// Mock recent searches
vi.mock('../../../utils/recentSearches', () => ({
  getRecentSearches: vi.fn(() => []),
  addRecentSearch: vi.fn(),
  removeRecentSearch: vi.fn(),
  clearRecentSearches: vi.fn(),
}));

describe('SearchDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSearchReturnValue = { ...defaultUseSearchReturn };
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <SearchDialog {...defaultProps} isOpen={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(<SearchDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should render search input with placeholder', () => {
      render(<SearchDialog {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search wiki...')).toBeInTheDocument();
    });

    it('should have correct ARIA attributes on dialog', () => {
      render(<SearchDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Search wiki');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have ARIA combobox attributes on input', () => {
      render(<SearchDialog {...defaultProps} />);
      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-label', 'Search wiki');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-controls', 'search-results');
    });

    it('should render Esc key hint', () => {
      render(<SearchDialog {...defaultProps} />);
      expect(screen.getByText('Esc')).toBeInTheDocument();
    });
  });

  describe('search results', () => {
    it('should display search results', () => {
      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'recipe',
        results: [
          {
            pageId: 'page-1',
            title: 'Family Recipes',
            snippet: 'Italian pasta and pizza recipes...',
            relevanceScore: 900,
            matchCount: 3,
            path: 'Cooking > Family Recipes',
            tags: ['recipe', 'italian'],
          },
        ],
        totalResults: 1,
      };

      render(<SearchDialog {...defaultProps} />);

      expect(screen.getByText(/Family Recipes/)).toBeInTheDocument();
      expect(screen.getByText('Cooking > Family Recipes')).toBeInTheDocument();
      // "recipe" appears both as a tag and highlighted in snippet
      expect(screen.getAllByText('recipe').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('italian')).toBeInTheDocument();
    });

    it('should show no results message', () => {
      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'xyznotfound',
        results: [],
        totalResults: 0,
      };

      render(<SearchDialog {...defaultProps} />);
      // Appears in both visible text and sr-only live region
      expect(screen.getAllByText(/No results found for/).length).toBeGreaterThanOrEqual(1);
    });

    it('should show result count and execution time in footer', () => {
      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'test',
        results: [
          {
            pageId: 'page-1',
            title: 'Test',
            snippet: 'test',
            relevanceScore: 100,
            matchCount: 1,
            path: 'Test',
            tags: [],
          },
        ],
        totalResults: 1,
        executionTimeMs: 42,
      };

      render(<SearchDialog {...defaultProps} />);
      expect(screen.getByText('1 result (42ms)')).toBeInTheDocument();
    });

    it('should show load more button when hasMore is true', () => {
      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'test',
        results: Array.from({ length: 10 }, (_, i) => ({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          snippet: '',
          relevanceScore: 100,
          matchCount: 1,
          path: `Page ${i}`,
          tags: [],
        })),
        totalResults: 25,
        hasMore: true,
      };

      render(<SearchDialog {...defaultProps} />);
      expect(screen.getByText('Load more results (10 of 25)')).toBeInTheDocument();
    });

    it('should show error message', () => {
      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'test',
        error: 'Failed to fetch search index',
      };

      render(<SearchDialog {...defaultProps} />);
      expect(screen.getByText('Failed to fetch search index')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('should close on Escape key', () => {
      render(<SearchDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should navigate with Enter key to select result', () => {
      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'test',
        results: [
          {
            pageId: 'page-1',
            title: 'Test Page',
            snippet: '',
            relevanceScore: 100,
            matchCount: 1,
            path: 'Test',
            tags: [],
          },
        ],
        totalResults: 1,
      };

      render(<SearchDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Enter' });
      expect(defaultProps.onNavigate).toHaveBeenCalledWith('page-1');
    });

    it('should open in new tab with Ctrl+Enter', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'test',
        results: [
          {
            pageId: 'page-1',
            title: 'Test Page',
            snippet: '',
            relevanceScore: 100,
            matchCount: 1,
            path: 'Test',
            tags: [],
          },
        ],
        totalResults: 1,
      };

      render(<SearchDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Enter', ctrlKey: true });
      expect(windowOpenSpy).toHaveBeenCalledWith('/pages/page-1', '_blank');

      windowOpenSpy.mockRestore();
    });
  });

  describe('click interactions', () => {
    it('should navigate on result click', () => {
      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'test',
        results: [
          {
            pageId: 'page-1',
            title: 'Click Me',
            snippet: '',
            relevanceScore: 100,
            matchCount: 1,
            path: 'Test',
            tags: [],
          },
        ],
        totalResults: 1,
      };

      render(<SearchDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Click Me'));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith('page-1');
    });

    it('should close on backdrop click', () => {
      render(<SearchDialog {...defaultProps} />);
      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not close when clicking inside the dialog', () => {
      render(<SearchDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('filters', () => {
    it('should toggle filter panel', () => {
      render(<SearchDialog {...defaultProps} />);

      // Filters should not be visible initially
      expect(screen.queryByLabelText('Title only')).not.toBeInTheDocument();

      // Click filter button
      fireEvent.click(screen.getByLabelText('Toggle search filters'));

      // Filters should now be visible
      expect(screen.getByText('Title only')).toBeInTheDocument();
      expect(screen.getByLabelText('Scope:')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have a live region for screen reader announcements', () => {
      render(<SearchDialog {...defaultProps} />);
      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('should have listbox role on results container', () => {
      render(<SearchDialog {...defaultProps} />);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have option role on results', () => {
      useSearchReturnValue = {
        ...defaultUseSearchReturn,
        query: 'test',
        results: [
          {
            pageId: 'page-1',
            title: 'Test',
            snippet: '',
            relevanceScore: 100,
            matchCount: 1,
            path: 'Test',
            tags: [],
          },
        ],
        totalResults: 1,
      };

      render(<SearchDialog {...defaultProps} />);
      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    it('should set maxLength on search input for XSS prevention', () => {
      render(<SearchDialog {...defaultProps} />);
      const input = screen.getByPlaceholderText('Search wiki...');
      expect(input).toHaveAttribute('maxLength', '500');
    });
  });
});
