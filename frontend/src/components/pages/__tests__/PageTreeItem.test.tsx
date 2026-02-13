/**
 * Tests for Page Tree Components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PageTreeItem } from '../PageTreeItem';
import { PageTreeNode } from '../../../types/page';

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

describe('PageTreeItem', () => {
  const mockPage: PageTreeNode = {
    guid: 'test-guid-1',
    title: 'Test Page',
    parentGuid: null,
    status: 'published',
    modifiedAt: '2026-02-10T12:00:00Z',
    modifiedBy: 'user-1',
    hasChildren: false,
    isExpanded: false,
  };

  const mockHandlers = {
    onSelect: vi.fn(),
    onContextMenu: vi.fn(),
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn(),
    onToggleExpand: vi.fn(),
  };

  it('renders page title', () => {
    const queryClient = createTestQueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <PageTreeItem
          page={mockPage}
          level={0}
          {...mockHandlers}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('shows document icon for pages without children', () => {
    const queryClient = createTestQueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <PageTreeItem
          page={mockPage}
          level={0}
          {...mockHandlers}
        />
      </QueryClientProvider>
    );

    const element = screen.getByRole('treeitem');
    expect(element).toBeInTheDocument();
  });

  it('shows folder icon for pages with children', () => {
    const queryClient = createTestQueryClient();
    const pageWithChildren: PageTreeNode = {
      ...mockPage,
      hasChildren: true,
    };
    
    render(
      <QueryClientProvider client={queryClient}>
        <PageTreeItem
          page={pageWithChildren}
          level={0}
          {...mockHandlers}
        />
      </QueryClientProvider>
    );

    const element = screen.getByRole('treeitem');
    expect(element).toBeInTheDocument();
  });

  it('shows draft badge for draft pages', () => {
    const queryClient = createTestQueryClient();
    const draftPage: PageTreeNode = {
      ...mockPage,
      status: 'draft',
    };
    
    render(
      <QueryClientProvider client={queryClient}>
        <PageTreeItem
          page={draftPage}
          level={0}
          {...mockHandlers}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows archived badge for archived pages', () => {
    const queryClient = createTestQueryClient();
    const archivedPage: PageTreeNode = {
      ...mockPage,
      status: 'archived',
    };
    
    render(
      <QueryClientProvider client={queryClient}>
        <PageTreeItem
          page={archivedPage}
          level={0}
          {...mockHandlers}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('highlights active page', () => {
    const queryClient = createTestQueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <PageTreeItem
          page={mockPage}
          level={0}
          isActive={true}
          {...mockHandlers}
        />
      </QueryClientProvider>
    );

    const element = screen.getByRole('treeitem');
    expect(element).toHaveClass('bg-blue-50');
  });

  it('shows expand button for pages with children', () => {
    const queryClient = createTestQueryClient();
    const pageWithChildren: PageTreeNode = {
      ...mockPage,
      hasChildren: true,
    };
    
    render(
      <QueryClientProvider client={queryClient}>
        <PageTreeItem
          page={pageWithChildren}
          level={0}
          {...mockHandlers}
        />
      </QueryClientProvider>
    );

    const expandButton = screen.getByLabelText('Expand');
    expect(expandButton).toBeInTheDocument();
  });
});
