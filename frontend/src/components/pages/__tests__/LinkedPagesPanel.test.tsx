/**
 * Tests for LinkedPagesPanel Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkedPagesPanel } from '../LinkedPagesPanel';
import { Backlink } from '../../../hooks/usePages';

describe('LinkedPagesPanel', () => {
  const mockBacklinks: Backlink[] = [
    {
      guid: 'page-1',
      title: 'Page One',
      linkText: 'link to target',
      createdAt: '2026-02-14T10:00:00Z',
    },
    {
      guid: 'page-2',
      title: 'Page Two',
      createdAt: '2026-02-14T11:00:00Z',
    },
    {
      guid: 'page-3',
      title: 'Another Page',
      linkText: 'check this out',
      createdAt: '2026-02-14T12:00:00Z',
    },
  ];

  it('should render loading state', () => {
    render(
      <LinkedPagesPanel
        pageGuid="target-page"
        backlinks={[]}
        isLoading={true}
        onPageClick={vi.fn()}
      />
    );

    // Should show loading skeletons
    expect(screen.getByText('Linked Pages')).toBeInTheDocument();
    
    // Check for loading skeletons (using animate-pulse class)
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should render empty state when no backlinks', () => {
    render(
      <LinkedPagesPanel
        pageGuid="target-page"
        backlinks={[]}
        isLoading={false}
        onPageClick={vi.fn()}
      />
    );

    expect(screen.getByText('Linked Pages')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // count badge
    expect(screen.getByText('No pages link to this page')).toBeInTheDocument();
  });

  it('should render backlinks list', () => {
    render(
      <LinkedPagesPanel
        pageGuid="target-page"
        backlinks={mockBacklinks}
        isLoading={false}
        onPageClick={vi.fn()}
      />
    );

    expect(screen.getByText('Linked Pages')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // count badge

    // All backlinks should be rendered
    expect(screen.getByText('Page One')).toBeInTheDocument();
    expect(screen.getByText('Page Two')).toBeInTheDocument();
    expect(screen.getByText('Another Page')).toBeInTheDocument();

    // Link text should be shown when available
    expect(screen.getByText('via: link to target')).toBeInTheDocument();
    expect(screen.getByText('via: check this out')).toBeInTheDocument();
  });

  it('should call onPageClick when backlink is clicked', () => {
    const onPageClick = vi.fn();

    render(
      <LinkedPagesPanel
        pageGuid="target-page"
        backlinks={mockBacklinks}
        isLoading={false}
        onPageClick={onPageClick}
      />
    );

    // Click on first backlink
    const pageOneButton = screen.getByText('Page One').closest('button');
    expect(pageOneButton).toBeInTheDocument();
    
    if (pageOneButton) {
      fireEvent.click(pageOneButton);
      expect(onPageClick).toHaveBeenCalledWith('page-1');
    }

    // Click on second backlink
    const pageTwoButton = screen.getByText('Page Two').closest('button');
    if (pageTwoButton) {
      fireEvent.click(pageTwoButton);
      expect(onPageClick).toHaveBeenCalledWith('page-2');
    }

    expect(onPageClick).toHaveBeenCalledTimes(2);
  });

  it('should display correct count badge', () => {
    const { rerender } = render(
      <LinkedPagesPanel
        pageGuid="target-page"
        backlinks={mockBacklinks}
        isLoading={false}
        onPageClick={vi.fn()}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();

    // Update with different count
    rerender(
      <LinkedPagesPanel
        pageGuid="target-page"
        backlinks={[mockBacklinks[0]]}
        isLoading={false}
        onPageClick={vi.fn()}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should not show count badge when loading', () => {
    render(
      <LinkedPagesPanel
        pageGuid="target-page"
        backlinks={[]}
        isLoading={true}
        onPageClick={vi.fn()}
      />
    );

    // Count badge should not be visible during loading
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(
      <LinkedPagesPanel
        pageGuid="target-page"
        backlinks={mockBacklinks}
        isLoading={false}
        onPageClick={vi.fn()}
      />
    );

    // Check for title attributes on buttons
    const pageOneButton = screen.getByTitle('Navigate to Page One');
    expect(pageOneButton).toBeInTheDocument();
    
    const pageTwoButton = screen.getByTitle('Navigate to Page Two');
    expect(pageTwoButton).toBeInTheDocument();
  });
});
