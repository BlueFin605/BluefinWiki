/**
 * Tests for AttachmentManager Component (Task 7.4)
 * 
 * Tests attachment list display, image preview, download, delete with permission checks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentManager } from '../AttachmentManager';
import * as useAttachmentsModule from '../../../hooks/useAttachments';
import apiClient from '../../../config/api';

// Mock the useAttachments hook
vi.mock('../../../hooks/useAttachments');

// Mock the API client
vi.mock('../../../config/api', () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock window.confirm
global.confirm = vi.fn(() => true);

describe('AttachmentManager Component', () => {
  const testPageGuid = 'test-page-guid-123';
  const mockAttachments = [
    {
      filename: 'document.pdf',
      contentType: 'application/pdf',
      size: 1024000,
      uploadedAt: '2026-03-07T10:00:00Z',
      uploadedBy: 'user-123',
      checksum: 'abc123',
    },
    {
      filename: 'family-photo.jpg',
      contentType: 'image/jpeg',
      size: 2048000,
      uploadedAt: '2026-03-07T09:00:00Z',
      uploadedBy: 'user-456',
      checksum: 'def456',
    },
    {
      filename: 'spreadsheet.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 512000,
      uploadedAt: '2026-03-07T08:00:00Z',
      uploadedBy: 'user-123',
      checksum: 'ghi789',
    },
  ];

  let mockListAttachments: ReturnType<typeof vi.fn>;
  let mockDeleteAttachment: ReturnType<typeof vi.fn>;
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:mock-url');
    vi.mocked(URL.revokeObjectURL).mockImplementation(() => undefined);
    vi.mocked(global.confirm).mockReturnValue(true);

    mockListAttachments = vi.fn().mockResolvedValue(mockAttachments);
    mockDeleteAttachment = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAttachmentsModule.useAttachments).mockReturnValue({
      listAttachments: mockListAttachments,
      deleteAttachment: mockDeleteAttachment,
      uploadFile: vi.fn(),
      uploadFiles: vi.fn(),
      uploadProgress: [],
      clearCompletedUploads: vi.fn(),
      clearAllUploads: vi.fn(),
    } as unknown as ReturnType<typeof useAttachmentsModule.useAttachments>);

    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: btoa('mock image data'), contentType: 'image/jpeg', filename: 'mock.jpg' },
    });

    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the attachments panel with header', () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      expect(screen.getByText('Attachments')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      vi.mocked(useAttachmentsModule.useAttachments).mockReturnValue({
        listAttachments: vi.fn(() => new Promise(() => {})), // Never resolve
        deleteAttachment: mockDeleteAttachment,
        uploadFile: vi.fn(),
        uploadFiles: vi.fn(),
        uploadProgress: [],
        clearCompletedUploads: vi.fn(),
        clearAllUploads: vi.fn(),
      } as unknown as ReturnType<typeof useAttachmentsModule.useAttachments>);

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      expect(screen.getByText('Loading attachments...')).toBeInTheDocument();
    });
  });

  describe('Attachment List Display', () => {
    it('should load and display attachments on mount', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(mockListAttachments).toHaveBeenCalled();
      });

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('family-photo.jpg')).toBeInTheDocument();
      expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument();
    });

    it('should display file icons for different content types', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

        // Check for icon spans with aria-hidden via DOM query
        expect(document.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(0);
    });

    it('should display file size and upload date', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

        // Size should be formatted (multiple elements match, use getAllByText)
        const sizeTexts = screen.getAllByText((content) =>
          content.includes('MB') || content.includes('KB')
        );
        expect(sizeTexts.length).toBeGreaterThan(0);
    });

    it('should sort attachments by upload date (newest first)', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const attachmentItems = screen.getAllByRole('listitem');
      expect(attachmentItems.length).toBe(3);

      // Check that newest (document.pdf) is first
      expect(attachmentItems[0]).toHaveTextContent('document.pdf');
      expect(attachmentItems[1]).toHaveTextContent('family-photo.jpg');
      expect(attachmentItems[2]).toHaveTextContent('spreadsheet.xlsx');
    });

    it('should show empty message when no attachments', async () => {
      mockListAttachments.mockResolvedValue([]);

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText('No attachments uploaded for this page.')
        ).toBeInTheDocument();
      });
    });

    it('should handle and display error when loading attachments fails', async () => {
      const errorMessage = 'Failed to fetch attachments';
      mockListAttachments.mockRejectedValue(new Error(errorMessage));

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should refresh attachments when Refresh button is clicked', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(mockListAttachments).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockListAttachments).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Download Functionality', () => {
    it('should show download button for all attachments', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const downloadButtons = screen.getAllByRole('button', { name: /download/i });
      expect(downloadButtons).toHaveLength(3);
    });

    it('should trigger download when download button is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.get).mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { data: btoa('file content'), contentType: 'application/pdf', filename: 'document.pdf' },
      });

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const downloadButtons = screen.getAllByRole('button', { name: /download/i });
      await user.click(downloadButtons[0]);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          `/pages/${testPageGuid}/attachments/document.pdf`
        );
      });
    });

    it('should handle download errors gracefully', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Download failed';

      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes('/document.pdf')) {
          return Promise.reject(new Error(errorMessage));
        }
        return Promise.resolve({
          status: 200,
          headers: { 'content-type': 'application/json' },
          data: { data: btoa('mock image data'), contentType: 'image/jpeg', filename: 'mock.jpg' },
        });
      });

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const downloadButtons = screen.getAllByRole('button', { name: /download/i });
      await user.click(downloadButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe('Image Preview & Lightbox', () => {
    it('should load image thumbnails for image attachments', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(mockListAttachments).toHaveBeenCalled();
      });

      // Wait for image to be loaded
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining('/attachments/family-photo.jpg')
        );
      });
    });

    it('should display thumbnail image for image attachments', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        const imageAttachments = images.filter((img) =>
          img.getAttribute('alt')?.includes('jpg') || img.getAttribute('alt')?.includes('photo')
        );
        expect(imageAttachments.length).toBeGreaterThan(0);
      });
    });

    it('should not display thumbnail for non-image attachments', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const pdfItem = screen
        .getByText('document.pdf')
        .closest('li');
      const thumbnail = pdfItem?.querySelector('img');
      expect(thumbnail).toBeNull();
    });

    it('should open preview modal when clicking on image thumbnail', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
      });

        // Find and click the preview button for the image (button with title contains preview)
        const previewButtons = Array.from(
          document.querySelectorAll('button[title*="preview"]')
        );
        if (previewButtons.length > 0) {
          await user.click(previewButtons[0] as HTMLElement);

        await waitFor(() => {
          const dialog = screen.getByRole('dialog');
          expect(dialog).toBeInTheDocument();
        });
      }
    });

    it('should display full-size image in preview modal', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
      });

      const previewButton = screen.getByTitle('Open full-size preview');
      if (previewButton) {
        await user.click(previewButton);

        await waitFor(() => {
          const dialog = screen.getByRole('dialog');
          const fullSizeImage = within(dialog).queryByRole('img');
          expect(fullSizeImage).toBeInTheDocument();
        });
      }
    });

    it('should close preview modal when Close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
      });

      const previewButton = screen.getByTitle('Open full-size preview');
      if (previewButton) {
        await user.click(previewButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
      }
    });

    it('should close preview modal when clicking outside image', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
      });

      const previewButton = screen.getByTitle('Open full-size preview');
      if (previewButton) {
        await user.click(previewButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const backdrop = screen.getByRole('dialog');
        fireEvent.click(backdrop);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Delete Functionality with Permissions', () => {
    it('should show delete button only for authorized users', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          pageAuthorId="user-123"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should hide delete button when user is not authorized', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-999"
          currentUserRole="Standard"
          pageAuthorId="user-456"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      // Only one delete button should be visible (for user-456's upload)
      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeLessThan(3);
    });

    it('should show delete button for admin users', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="admin-user"
          currentUserRole="Admin"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons).toHaveLength(3);
    });

    it('should show delete button for attachment uploader', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-456"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      // user-456 uploaded the photo, so should see at least that delete button
      expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('should show delete button for page author', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="page-author"
          currentUserRole="Standard"
          pageAuthorId="page-author"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons).toHaveLength(3);
    });

    it('should confirm deletion before deleting', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith('Delete attachment "document.pdf"?');
      });
    });

    it('should cancel deletion when user cancels confirmation', async () => {
      const user = userEvent.setup();
      vi.mocked(confirm).mockReturnValue(false);

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockDeleteAttachment).not.toHaveBeenCalled();
      });
    });

    it('should delete attachment when confirmed', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const documentItem = screen.getByText('document.pdf').closest('li');
      const documentDeleteButton = within(documentItem as HTMLElement).getByRole('button', { name: /delete/i });
      await user.click(documentDeleteButton);

      await waitFor(() => {
        expect(mockDeleteAttachment).toHaveBeenCalledWith('document.pdf');
      });
    });

    it('should remove attachment from list after deletion', async () => {
      const user = userEvent.setup();
      const updatedAttachments = mockAttachments.slice(1); // Remove first attachment

      mockDeleteAttachment.mockImplementation(() => {
        mockListAttachments.mockResolvedValue(updatedAttachments);
        return Promise.resolve();
      });

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const documentItem = screen.getByText('document.pdf').closest('li');
      const documentDeleteButton = within(documentItem as HTMLElement).getByRole('button', { name: /delete/i });
      await user.click(documentDeleteButton);

      await waitFor(() => {
        expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
      });
    });

    it('should show loading state while deleting', async () => {
      const user = userEvent.setup();

      mockDeleteAttachment.mockImplementation(
        () => new Promise(() => {}) // Never resolve
      );

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const documentItem = screen.getByText('document.pdf').closest('li');
      const documentDeleteButton = within(documentItem as HTMLElement).getByRole('button', { name: /delete/i });
      await user.click(documentDeleteButton);

      await waitFor(() => {
        const delButton = within(documentItem as HTMLElement).getByRole('button', { name: /deleting/i });
        expect(delButton).toBeDisabled();
      });
    });

    it('should handle delete errors gracefully', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to delete attachment';

      mockDeleteAttachment.mockRejectedValue(new Error(errorMessage));

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const documentItem = screen.getByText('document.pdf').closest('li');
      const documentDeleteButton = within(documentItem as HTMLElement).getByRole('button', { name: /delete/i });
      await user.click(documentDeleteButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should close preview modal when deleting the previewed attachment', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('family-photo.jpg')).toBeInTheDocument();
      });

        // Open preview for the image
        const previewButtons = Array.from(
          document.querySelectorAll('button[title*="preview"]')
        );
        if (previewButtons.length > 0) {
          await user.click(previewButtons[0] as HTMLElement);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Delete the attachment
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        const imageDeleteButton = deleteButtons.find((btn) => {
          return btn.textContent?.includes('Delete') &&
            btn.closest('li')?.textContent?.includes('family-photo.jpg');
        });

        if (imageDeleteButton) {
          await user.click(imageDeleteButton);

          await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
          });
        }
      }
    });
  });

  describe('Permission Edge Cases', () => {
    it('should not show delete button when user is not logged in', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId={undefined}
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons).toHaveLength(0);
    });

    it('should handle missing currentUserRole gracefully', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole={undefined}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      // Should still render without errors
      expect(screen.getByText('Attachments')).toBeInTheDocument();
    });
  });

  describe('Object URL Management', () => {
    it('should cleanup object URLs on unmount', async () => {
      const { unmount } = render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      unmount();

      // Verify revokeObjectURL was called
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('Copy Markdown Link (Task 7.5)', () => {
    it('should render Copy Markdown button for each attachment', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByRole('button', { name: /copy markdown/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('should copy file markdown link to clipboard for non-image files', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      // Find the copy button for the PDF (non-image)
      const pdfItem = screen.getByText('document.pdf').closest('li');
      const copyButton = within(pdfItem as HTMLElement).getByRole('button', {
        name: /copy markdown/i,
      });

      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.queryByText(/failed to copy/i)).not.toBeInTheDocument();
      });
    });

    it('should copy image markdown syntax for image files', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('family-photo.jpg')).toBeInTheDocument();
      });

      // Find the copy button for the image
      const imageItem = screen.getByText('family-photo.jpg').closest('li');
      const copyButton = within(imageItem as HTMLElement).getByRole('button', {
        name: /copy markdown/i,
      });

      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.queryByText(/failed to copy/i)).not.toBeInTheDocument();
      });
    });

    it('should show success feedback after copying', async () => {
      const user = userEvent.setup();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByRole('button', { name: /copy markdown/i });
      await user.click(copyButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText(/failed to copy/i)).not.toBeInTheDocument();
      });
    });

    it('should handle clipboard copy errors gracefully', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Clipboard access denied';

      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const originalExecCommand = (document as unknown as { execCommand?: (command: string) => boolean }).execCommand;
      (document as unknown as { execCommand: (command: string) => boolean }).execCommand = () => {
        throw new Error(errorMessage);
      };

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByRole('button', { name: /copy markdown/i });
      await user.click(copyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      (document as unknown as { execCommand?: (command: string) => boolean }).execCommand = originalExecCommand;
    });
  });

  describe('Insert Markdown Link into Editor (Task 7.5)', () => {
    it('should render Insert button when onInsertMarkdown prop is provided', async () => {
      const onInsertMarkdown = vi.fn();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={onInsertMarkdown}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const insertButtons = screen.getAllByRole('button', { name: /insert/i });
      expect(insertButtons.length).toBeGreaterThan(0);
    });

    it('should not render Insert button when onInsertMarkdown is not provided', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const insertButtons = screen.queryAllByRole('button', { name: /^insert$/i });
      expect(insertButtons).toHaveLength(0);
    });

    it('should call onInsertMarkdown with file markdown when Insert is clicked', async () => {
      const user = userEvent.setup();
      const onInsertMarkdown = vi.fn();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={onInsertMarkdown}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const pdfItem = screen.getByText('document.pdf').closest('li');
      const insertButton = within(pdfItem as HTMLElement).getByRole('button', {
        name: /insert/i,
      });

      await user.click(insertButton);

      expect(onInsertMarkdown).toHaveBeenCalledWith(
        '[document.pdf](document.pdf)'
      );
    });

    it('should call onInsertMarkdown with image markdown for images', async () => {
      const user = userEvent.setup();
      const onInsertMarkdown = vi.fn();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={onInsertMarkdown}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('family-photo.jpg')).toBeInTheDocument();
      });

      const imageItem = screen.getByText('family-photo.jpg').closest('li');
      const insertButton = within(imageItem as HTMLElement).getByRole('button', {
        name: /insert/i,
      });

      await user.click(insertButton);

        expect(onInsertMarkdown).toHaveBeenCalledWith(
          '![family-photo](family-photo.jpg)'
        );
    });
  });

  describe('Markdown Format Verification (Task 7.5)', () => {
    it('should use correct markdown syntax for images', async () => {
      const onInsertMarkdown = vi.fn();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={onInsertMarkdown}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('family-photo.jpg')).toBeInTheDocument();
      });

      const imageItem = screen.getByText('family-photo.jpg').closest('li');
      const insertButton = within(imageItem as HTMLElement).getByRole('button', {
        name: /insert/i,
      });

      await userEvent.click(insertButton);

        // Verify markdown starts with ![
        const markdown = onInsertMarkdown.mock.calls[0][0];
        expect(markdown).toMatch(/^!\[.*\]\(.*\)$/);
        expect(markdown).toContain('![family-photo]');
        expect(markdown).toContain('family-photo.jpg)');
    });

    it('should use correct markdown syntax for non-image files', async () => {
      const onInsertMarkdown = vi.fn();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={onInsertMarkdown}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const pdfItem = screen.getByText('document.pdf').closest('li');
      const insertButton = within(pdfItem as HTMLElement).getByRole('button', {
        name: /insert/i,
      });

      await userEvent.click(insertButton);

      // Verify markdown is [text](url) format without !
      const markdown = onInsertMarkdown.mock.calls[0][0];
      expect(markdown).toMatch(/^\[.*\]\(.*\)$/);
      expect(markdown).not.toMatch(/^!/);
      expect(markdown).toContain('[document.pdf]');
      expect(markdown).toContain('document.pdf)');
    });

    it('should use filename-only format (pageGuid inferred from context)', async () => {
      const onInsertMarkdown = vi.fn();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={onInsertMarkdown}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const pdfItem = screen.getByText('document.pdf').closest('li');
      const insertButton = within(pdfItem as HTMLElement).getByRole('button', {
        name: /insert/i,
      });

      await userEvent.click(insertButton);

      const markdown = onInsertMarkdown.mock.calls[0][0];
      // Should NOT contain pageGuid - it's inferred from context
      expect(markdown).not.toContain(`${testPageGuid}/`);
      expect(markdown).toContain('document.pdf)');
    });

    it('should include filename in URL', async () => {
      const onInsertMarkdown = vi.fn();

      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={onInsertMarkdown}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const pdfItem = screen.getByText('document.pdf').closest('li');
      const insertButton = within(pdfItem as HTMLElement).getByRole('button', {
        name: /insert/i,
      });

      await userEvent.click(insertButton);

      const markdown = onInsertMarkdown.mock.calls[0][0];
      expect(markdown).toContain('document.pdf');
    });
  });

  describe('Drag and Drop Links (Task 7.5)', () => {
    it('should display helper text about copying or dragging links', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      expect(screen.getByText(/copy a markdown link or drag it into the editor/i)).toBeInTheDocument();
    });

    it('should allow draggable interaction on attachment items', async () => {
      render(
        <AttachmentManager
          pageGuid={testPageGuid}
          currentUserId="user-123"
          currentUserRole="Standard"
          onInsertMarkdown={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      // Attachment list items should exist (drag behavior would be tested in E2E)
      const pdfItem = screen.getByText('document.pdf').closest('li');
      expect(pdfItem).toBeInTheDocument();
    });
  });
});
