/**
 * LinkAutocomplete Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LinkAutocomplete from '../LinkAutocomplete';
import * as usePages from '../../../hooks/usePages';

// Mock the usePageSearch hook
vi.mock('../../../hooks/usePages', () => ({
  usePageSearch: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('LinkAutocomplete', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();
  const mockPosition = { top: 100, left: 200 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when visible is false', () => {
    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    const { container } = render(
      <LinkAutocomplete
        query="test"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={false}
      />,
      { wrapper: createWrapper() }
    );

    expect(container.firstChild).toBeNull();
  });

  it('should show loading state', () => {
    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: [],
      isLoading: true,
    } as any);

    render(
      <LinkAutocomplete
        query="test"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('should show "no pages found" message when no results', () => {
    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <LinkAutocomplete
        query="nonexistent"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('No pages found')).toBeInTheDocument();
  });

  it('should render suggestions when data is available', () => {
    const mockSuggestions = [
      { guid: '1', title: 'Page One', path: 'Root > Page One', folderId: null },
      { guid: '2', title: 'Page Two', path: 'Root > Folder > Page Two', folderId: 'folder-1' },
    ];

    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: mockSuggestions,
      isLoading: false,
    } as any);

    render(
      <LinkAutocomplete
        query="page"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Page One')).toBeInTheDocument();
    expect(screen.getByText('Page Two')).toBeInTheDocument();
    expect(screen.getByText('Root > Page One')).toBeInTheDocument();
    expect(screen.getByText('Root > Folder > Page Two')).toBeInTheDocument();
  });

  it('should call onSelect when a suggestion is clicked', async () => {
    const mockSuggestions = [
      { guid: '1', title: 'Page One', path: 'Root > Page One', folderId: null },
    ];

    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: mockSuggestions,
      isLoading: false,
    } as any);

    render(
      <LinkAutocomplete
        query="page"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    const button = screen.getByText('Page One').closest('button');
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button!);

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });
  });

  it('should apply correct positioning styles', () => {
    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    const { container } = render(
      <LinkAutocomplete
        query="test"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    const dropdown = container.querySelector('.absolute');
    expect(dropdown).toHaveStyle({
      top: '100px',
      left: '200px',
    });
  });

  it('should highlight selected item on hover', () => {
    const mockSuggestions = [
      { guid: '1', title: 'Page One', path: 'Root > Page One', folderId: null },
      { guid: '2', title: 'Page Two', path: 'Root > Page Two', folderId: null },
    ];

    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: mockSuggestions,
      isLoading: false,
    } as any);

    render(
      <LinkAutocomplete
        query="page"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    const firstButton = screen.getByText('Page One').closest('button');
    const secondButton = screen.getByText('Page Two').closest('button');

    // Initially, first item should be highlighted
    expect(firstButton).toHaveClass('bg-blue-50');
    expect(secondButton).not.toHaveClass('bg-blue-50');

    // Hover over second item
    fireEvent.mouseEnter(secondButton!);

    // Second item should now be highlighted
    expect(secondButton).toHaveClass('bg-blue-50');
  });

  it('should show "start typing" message when query is empty', () => {
    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <LinkAutocomplete
        query=""
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Start typing to search for pages')).toBeInTheDocument();
  });

  it('should handle keyboard navigation (Arrow Down)', () => {
    const mockSuggestions = [
      { guid: '1', title: 'Page One', path: 'Root > Page One', folderId: null },
      { guid: '2', title: 'Page Two', path: 'Root > Page Two', folderId: null },
    ];

    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: mockSuggestions,
      isLoading: false,
    } as any);

    render(
      <LinkAutocomplete
        query="page"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    const firstButton = screen.getByText('Page One').closest('button');
    const secondButton = screen.getByText('Page Two').closest('button');

    // Initially, first item should be highlighted
    expect(firstButton).toHaveClass('bg-blue-50');

    // Press Arrow Down
    fireEvent.keyDown(document, { key: 'ArrowDown' });

    // Second item should now be highlighted
    expect(secondButton).toHaveClass('bg-blue-50');
  });

  it('should handle keyboard navigation (Enter)', async () => {
    const mockSuggestions = [
      { guid: '1', title: 'Page One', path: 'Root > Page One', folderId: null },
    ];

    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: mockSuggestions,
      isLoading: false,
    } as any);

    render(
      <LinkAutocomplete
        query="page"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    // Press Enter
    fireEvent.keyDown(document, { key: 'Enter' });

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });
  });

  it('should handle keyboard navigation (Escape)', () => {
    vi.spyOn(usePages, 'usePageSearch').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <LinkAutocomplete
        query="page"
        position={mockPosition}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        visible={true}
      />,
      { wrapper: createWrapper() }
    );

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });
});

