/**
 * Tests for PageEditor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PageEditor } from '../PageEditor';
import * as usePages from '../../../hooks/usePages';

// Mock the hooks
vi.mock('../../../hooks/usePages');

// Mock the EditorPane component
vi.mock('../../editor/EditorPane', () => ({
  EditorPane: ({ onContentChange, onSave, metadata }: any) => (
    <div data-testid="editor-pane">
      <button onClick={() => onContentChange('new content')}>Change Content</button>
      <button onClick={onSave}>Save</button>
      {metadata && <div data-testid="metadata">{metadata.title}</div>}
    </div>
  ),
}));

describe('PageEditor', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderPageEditor = (pageGuid: string) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <PageEditor pageGuid={pageGuid} />
      </QueryClientProvider>
    );
  };

  it('shows loading state while fetching page', () => {
    vi.mocked(usePages.usePageDetail).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(usePages.useUpdatePage).mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);

    renderPageEditor('test-guid');

    expect(screen.getByText('Loading page...')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', () => {
    const mockRefetch = vi.fn();
    vi.mocked(usePages.usePageDetail).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { response: { data: { message: 'Page not found' } } },
      refetch: mockRefetch,
    } as any);

    vi.mocked(usePages.useUpdatePage).mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);

    renderPageEditor('test-guid');

    expect(screen.getByText('Failed to Load Page')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();

    // Test retry button
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders editor when page data loads', async () => {
    vi.mocked(usePages.usePageDetail).mockReturnValue({
      data: {
        guid: 'test-guid',
        title: 'Test Page',
        content: '# Test Content',
        folderId: 'folder-1',
        tags: ['test'],
        status: 'draft',
        createdBy: 'user1',
        modifiedBy: 'user1',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(usePages.useUpdatePage).mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);

    renderPageEditor('test-guid');

    await waitFor(() => {
      expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
      expect(screen.getByTestId('metadata')).toHaveTextContent('Test Page');
    });
  });

  it('handles save successfully', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({});

    vi.mocked(usePages.usePageDetail).mockReturnValue({
      data: {
        guid: 'test-guid',
        title: 'Test Page',
        content: '# Test Content',
        folderId: 'folder-1',
        tags: ['test'],
        status: 'draft',
        createdBy: 'user1',
        modifiedBy: 'user1',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(usePages.useUpdatePage).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as any);

    renderPageEditor('test-guid');

    await waitFor(() => {
      expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
    });

    // Trigger save
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        content: '# Test Content',
        title: 'Test Page',
        tags: ['test'],
        status: 'draft',
      });
    });
  });

  it('shows conflict dialog on 409 error', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue({
      response: { status: 409 },
    });

    vi.mocked(usePages.usePageDetail).mockReturnValue({
      data: {
        guid: 'test-guid',
        title: 'Test Page',
        content: '# Test Content',
        folderId: 'folder-1',
        tags: ['test'],
        status: 'draft',
        createdBy: 'user1',
        modifiedBy: 'user1',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(usePages.useUpdatePage).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as any);

    renderPageEditor('test-guid');

    await waitFor(() => {
      expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
    });

    // Trigger save
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Conflict Detected')).toBeInTheDocument();
      expect(screen.getByText('Keep My Changes (Overwrite)')).toBeInTheDocument();
      expect(screen.getByText('Use Their Changes (Discard Mine)')).toBeInTheDocument();
    });
  });

  it('retries on server error', async () => {
    const mockMutateAsync = vi.fn()
      .mockRejectedValueOnce({ response: { status: 500 } });

    vi.mocked(usePages.usePageDetail).mockReturnValue({
      data: {
        guid: 'test-guid',
        title: 'Test Page',
        content: '# Test Content',
        folderId: 'folder-1',
        tags: ['test'],
        status: 'draft',
        createdBy: 'user1',
        modifiedBy: 'user1',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(usePages.useUpdatePage).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as any);

    renderPageEditor('test-guid');

    await waitFor(() => {
      expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
    });

    // Trigger save
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    // Wait for first call and error message
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Save failed\. Retrying\.\.\./)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error banner on save failure', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue({
      response: { status: 400, data: { message: 'Validation failed' } },
    });

    vi.mocked(usePages.usePageDetail).mockReturnValue({
      data: {
        guid: 'test-guid',
        title: 'Test Page',
        content: '# Test Content',
        folderId: 'folder-1',
        tags: ['test'],
        status: 'draft',
        createdBy: 'user1',
        modifiedBy: 'user1',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(usePages.useUpdatePage).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as any);

    renderPageEditor('test-guid');

    await waitFor(() => {
      expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
    });

    // Trigger save
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    // Should call the mutation and show error message
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    await waitFor(() => {
      const errorElements = screen.queryAllByText('Validation failed');
      expect(errorElements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});
