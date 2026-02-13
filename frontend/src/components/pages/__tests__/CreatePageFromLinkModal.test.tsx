/**
 * CreatePageFromLinkModal Component Tests
 * 
 * Tests for the page creation modal triggered by broken wiki links
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreatePageFromLinkModal } from '../CreatePageFromLinkModal';
import * as usePages from '../../../hooks/usePages';

// Mock the usePages hooks
vi.mock('../../../hooks/usePages', () => ({
  useCreatePage: vi.fn(),
}));

describe('CreatePageFromLinkModal', () => {
  let queryClient: QueryClient;
  let mockMutateAsync: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnPageCreated: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockMutateAsync = vi.fn();
    mockOnClose = vi.fn();
    mockOnPageCreated = vi.fn();

    vi.mocked(usePages.useCreatePage).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as any);
  });

  const renderModal = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CreatePageFromLinkModal
          isOpen={true}
          onClose={mockOnClose}
          linkText="Test Page"
          currentPageGuid="current-page-123"
          onPageCreated={mockOnPageCreated}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      renderModal({ isOpen: false });
      expect(screen.queryByText('Create Page from Link')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      renderModal();
      expect(screen.getByText('Create Page from Link')).toBeInTheDocument();
    });

    it('should pre-fill title from linkText prop', () => {
      renderModal({ linkText: 'My New Page' });
      const titleInput = screen.getByLabelText(/Page Title/i);
      expect(titleInput).toHaveValue('My New Page');
    });

    it('should display info message about broken link', () => {
      renderModal({ linkText: 'Test Page' });
      expect(screen.getByText(/This will create a new page for the broken link/i)).toBeInTheDocument();
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    it('should show parent page context when currentPageGuid is provided', () => {
      renderModal({ currentPageGuid: 'parent-123' });
      expect(screen.getByText(/Will be created under the current page/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when title is empty', async () => {
      renderModal();
      
      // Clear the pre-filled title
      const titleInput = screen.getByLabelText(/Page Title/i);
      fireEvent.change(titleInput, { target: { value: '' } });
      
      const submitButton = screen.getByRole('button', { name: /Create Page/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
      });
    });

    it('should show error when title is too short', async () => {
      renderModal();
      
      const titleInput = screen.getByLabelText(/Page Title/i);
      fireEvent.change(titleInput, { target: { value: 'ab' } });
      
      const submitButton = screen.getByRole('button', { name: /Create Page/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Title must be at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('should show error when title is too long', async () => {
      renderModal();
      
      const titleInput = screen.getByLabelText(/Page Title/i);
      const longTitle = 'a'.repeat(101);
      fireEvent.change(titleInput, { target: { value: longTitle } });
      
      const submitButton = screen.getByRole('button', { name: /Create Page/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Title must be less than 100 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Root Page Checkbox', () => {
    it('should allow creating as root page', () => {
      renderModal();
      
      const rootPageCheckbox = screen.getByLabelText(/Create as root page/i);
      expect(rootPageCheckbox).not.toBeChecked();
      
      fireEvent.click(rootPageCheckbox);
      expect(rootPageCheckbox).toBeChecked();
    });

    it('should hide parent selection when root page is checked', () => {
      renderModal({ currentPageGuid: null });
      
      // Initially parent selection should be visible
      expect(screen.getByLabelText(/Parent Page/i)).toBeInTheDocument();
      
      // Check root page checkbox
      const rootPageCheckbox = screen.getByLabelText(/Create as root page/i);
      fireEvent.click(rootPageCheckbox);
      
      // Parent selection should be hidden
      expect(screen.queryByLabelText(/Parent Page/i)).not.toBeInTheDocument();
    });
  });

  describe('Page Creation', () => {
    it('should create page with correct data', async () => {
      mockMutateAsync.mockResolvedValue({
        guid: 'new-page-123',
        title: 'Test Page',
      });

      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /Create Page/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          title: 'Test Page',
          parentGuid: 'current-page-123',
          content: '# Test Page\n\nStart writing your page content here...',
        });
      });
    });

    it('should call onPageCreated callback with new page data', async () => {
      mockMutateAsync.mockResolvedValue({
        guid: 'new-page-123',
        title: 'Test Page',
      });

      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /Create Page/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnPageCreated).toHaveBeenCalledWith('new-page-123', 'Test Page');
      });
    });

    it('should close modal after successful creation', async () => {
      mockMutateAsync.mockResolvedValue({
        guid: 'new-page-123',
        title: 'Test Page',
      });

      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /Create Page/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show error message on creation failure', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Failed to create page'));

      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /Create Page/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to create page/i)).toBeInTheDocument();
      });
    });

    it('should disable submit button while creating', () => {
      vi.mocked(usePages.useCreatePage).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
        isError: false,
        error: null,
      } as any);

      renderModal();
      
      const submitButton = screen.getByRole('button', { name: /Creating.../i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Modal Controls', () => {
    it('should close modal when close button is clicked', () => {
      renderModal();
      
      const closeButton = screen.getByLabelText(/Close/i);
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal when cancel button is clicked', () => {
      renderModal();
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal when clicking outside', () => {
      renderModal();
      
      const backdrop = screen.getByRole('dialog').parentElement;
      fireEvent.click(backdrop!);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close modal when clicking inside', () => {
      renderModal();
      
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Root Page Creation', () => {
    it('should create as root page when checkbox is checked', async () => {
      mockMutateAsync.mockResolvedValue({
        guid: 'new-page-123',
        title: 'Test Page',
      });

      renderModal();
      
      const rootPageCheckbox = screen.getByLabelText(/Create as root page/i);
      fireEvent.click(rootPageCheckbox);
      
      const submitButton = screen.getByRole('button', { name: /Create Page/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            parentGuid: null,
          })
        );
      });
    });
  });
});
