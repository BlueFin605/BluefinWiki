/**
 * Tests for useAttachments Hook (Task 7.3)
 * 
 * Tests upload flow, progress tracking, FormData creation, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAttachments } from '../useAttachments';
import apiClient from '../../config/api';

// Mock the API client
vi.mock('../../config/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useAttachments Hook', () => {
  const testPageGuid = 'test-page-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const mockResponse = {
        data: {
          attachmentGuid: 'attachment-123',
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/attachments/test.pdf',
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const response = await result.current.uploadFile(file);

      expect(response).toEqual(mockResponse.data);
      expect(apiClient.post).toHaveBeenCalledWith(
        `/pages/${testPageGuid}/attachments`,
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
    });

    it('should create FormData with file', async () => {
      const mockResponse = {
        data: {
          attachmentGuid: 'attachment-123',
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/test.pdf',
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await result.current.uploadFile(file);

      const postCall = vi.mocked(apiClient.post).mock.calls[0];
      const formData = postCall[1] as FormData;

      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('file')).toBe(file);
    });

    it('should track upload progress', async () => {
      let progressCallback: ((event: any) => void) | undefined;
      let resolveUpload: (value: any) => void;

      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve;
      });

      vi.mocked(apiClient.post).mockImplementation((_url, _data, config) => {
        progressCallback = config?.onUploadProgress;
        
        // Simulate progress events
        setTimeout(() => {
          if (progressCallback) {
            progressCallback({ loaded: 50, total: 100 });
          }
        }, 50);

        setTimeout(() => {
          if (progressCallback) {
            progressCallback({ loaded: 100, total: 100 });
          }
          resolveUpload!({
            data: {
              attachmentGuid: 'attachment-123',
              filename: 'test.pdf',
              contentType: 'application/pdf',
              size: 1024,
              url: 'https://example.com/test.pdf',
            },
          });
        }, 100);

        return uploadPromise as any;
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const fileUploadPromise = result.current.uploadFile(file);

      // Wait for upload to start
      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress.length).toBeGreaterThan(0);
      }, { timeout: 500 });

      // Wait for 50% progress
      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress[0].progress).toBe(50);
      }, { timeout: 500 });

      // Wait for completion
      await fileUploadPromise;

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress[0].status).toBe('completed');
        expect(progress[0].progress).toBe(100);
      });
    });

    it('should initialize upload progress tracking', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          attachmentGuid: 'attachment-123',
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/test.pdf',
        },
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      result.current.uploadFile(file);

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress.length).toBe(1);
        expect(progress[0].file).toBe(file);
        expect(['pending', 'uploading', 'completed']).toContain(progress[0].status);
      });
    });

    it('should update to uploading status', async () => {
      vi.mocked(apiClient.post).mockImplementation(() => {
        return new Promise(() => {}); // Never resolve
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      result.current.uploadFile(file);

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress[0].status).toBe('uploading');
      });
    });

    it('should handle upload errors', async () => {
      const errorMessage = 'Upload failed: Network error';
      vi.mocked(apiClient.post).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      await expect(result.current.uploadFile(file)).rejects.toThrow(errorMessage);

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress[0].status).toBe('failed');
        expect(progress[0].error).toBe(errorMessage);
      });
    });

    it('should reject invalid file types', async () => {
      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test'], 'bad.exe', { type: 'application/x-msdownload' });

      await expect(result.current.uploadFile(file)).rejects.toThrow(/not supported/);

      // Should not call API
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should reject files over size limit', async () => {
      const { result } = renderHook(() => useAttachments(testPageGuid));

      // 15MB image (over 10MB limit)
      const file = new File([new ArrayBuffer(15 * 1024 * 1024)], 'huge.png', {
        type: 'image/png',
      });

      await expect(result.current.uploadFile(file)).rejects.toThrow(/too large/);

      // Should not call API
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should include attachmentGuid and url in completed progress', async () => {
      const mockResponse = {
        data: {
          attachmentGuid: 'attachment-456',
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/files/test.pdf',
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      await result.current.uploadFile(file);

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress[0].attachmentGuid).toBe('attachment-456');
        expect(progress[0].url).toBe('https://example.com/files/test.pdf');
      });
    });
  });

  describe('uploadFiles (Multiple)', () => {
    it('should upload multiple files sequentially', async () => {
      const mockResponses = [
        {
          data: {
            attachmentGuid: 'attachment-1',
            filename: 'file1.pdf',
            contentType: 'application/pdf',
            size: 1024,
            url: 'https://example.com/file1.pdf',
          },
        },
        {
          data: {
            attachmentGuid: 'attachment-2',
            filename: 'file2.png',
            contentType: 'image/png',
            size: 2048,
            url: 'https://example.com/file2.png',
          },
        },
      ];

      let callCount = 0;
      vi.mocked(apiClient.post).mockImplementation(() => {
        return Promise.resolve(mockResponses[callCount++]);
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.png', { type: 'image/png' }),
      ];

      const uploadResult = await result.current.uploadFiles(files);

      expect(uploadResult.successful).toHaveLength(2);
      expect(uploadResult.failed).toHaveLength(0);
      expect(uploadResult.successful[0].attachmentGuid).toBe('attachment-1');
      expect(uploadResult.successful[1].attachmentGuid).toBe('attachment-2');
      expect(apiClient.post).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure', async () => {
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({
          data: {
            attachmentGuid: 'attachment-1',
            filename: 'file1.pdf',
            contentType: 'application/pdf',
            size: 1024,
            url: 'https://example.com/file1.pdf',
          },
        })
        .mockRejectedValueOnce(new Error('Upload failed'));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
      ];

      const uploadResult = await result.current.uploadFiles(files);

      expect(uploadResult.successful).toHaveLength(1);
      expect(uploadResult.failed).toHaveLength(1);
      expect(uploadResult.successful[0].attachmentGuid).toBe('attachment-1');
      expect(uploadResult.failed[0].file).toBe(files[1]);
      expect(uploadResult.failed[0].error).toBe('Upload failed');
    });

    it('should continue uploading after one failure', async () => {
      vi.mocked(apiClient.post)
        .mockRejectedValueOnce(new Error('First upload failed'))
        .mockResolvedValueOnce({
          data: {
            attachmentGuid: 'attachment-2',
            filename: 'file2.pdf',
            contentType: 'application/pdf',
            size: 1024,
            url: 'https://example.com/file2.pdf',
          },
        });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
      ];

      const uploadResult = await result.current.uploadFiles(files);

      expect(uploadResult.successful).toHaveLength(1);
      expect(uploadResult.failed).toHaveLength(1);
      expect(uploadResult.successful[0].attachmentGuid).toBe('attachment-2');
      expect(apiClient.post).toHaveBeenCalledTimes(2);
    });

    it('should validate all files before upload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          attachmentGuid: 'attachment-1',
          filename: 'valid.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/valid.pdf',
        },
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['valid'], 'valid.pdf', { type: 'application/pdf' }),
        new File(['invalid'], 'bad.exe', { type: 'application/x-msdownload' }),
      ];

      const uploadResult = await result.current.uploadFiles(files);

      expect(uploadResult.successful).toHaveLength(1);
      expect(uploadResult.failed).toHaveLength(1);
      expect(uploadResult.failed[0].error).toContain('not supported');
      // Should only call API for valid file
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('listAttachments', () => {
    it('should fetch attachments for page', async () => {
      const mockAttachments = [
        {
          attachmentId: 'attachment-1',
          originalFilename: 'doc1.pdf',
          contentType: 'application/pdf',
          size: 1024,
          uploadedAt: '2026-03-07T10:00:00Z',
          uploadedBy: 'user-123',
        },
        {
          attachmentId: 'attachment-2',
          originalFilename: 'image.png',
          contentType: 'image/png',
          size: 2048,
          uploadedAt: '2026-03-07T11:00:00Z',
          uploadedBy: 'user-456',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { attachments: mockAttachments },
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const attachments = await result.current.listAttachments();

      expect(attachments).toEqual(mockAttachments);
      expect(apiClient.get).toHaveBeenCalledWith(`/pages/${testPageGuid}/attachments`);
    });

    it('should handle errors when listing attachments', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch'));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      await expect(result.current.listAttachments()).rejects.toThrow('Failed to fetch');
    });
  });

  describe('deleteAttachment', () => {
    it('should delete an attachment', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const attachmentGuid = 'attachment-to-delete';
      await result.current.deleteAttachment(attachmentGuid);

      expect(apiClient.delete).toHaveBeenCalledWith(
        `/pages/${testPageGuid}/attachments/${attachmentGuid}`
      );
    });

    it('should handle delete errors', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      await expect(result.current.deleteAttachment('attachment-123')).rejects.toThrow(
        'Delete failed'
      );
    });
  });

  describe('Progress Management', () => {
    it('should clear completed uploads', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          attachmentGuid: 'attachment-1',
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/test.pdf',
        },
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      await result.current.uploadFile(file);

      await waitFor(() => {
        expect(result.current.uploadProgress.length).toBe(1);
        expect(result.current.uploadProgress[0].status).toBe('completed');
      });

      result.current.clearCompletedUploads();

      await waitFor(() => {
        expect(result.current.uploadProgress.length).toBe(0);
      });
    });

    it('should not clear failed uploads when clearing completed', async () => {
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({
          data: {
            attachmentGuid: 'attachment-1',
            filename: 'success.pdf',
            contentType: 'application/pdf',
            size: 1024,
            url: 'https://example.com/success.pdf',
          },
        })
        .mockRejectedValueOnce(new Error('Upload failed'));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['content1'], 'success.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'failed.pdf', { type: 'application/pdf' }),
      ];

      await result.current.uploadFiles(files);

      await waitFor(() => {
        expect(result.current.uploadProgress.length).toBe(2);
      });

      result.current.clearCompletedUploads();

      await waitFor(() => {
        // Only failed upload should remain
        expect(result.current.uploadProgress.length).toBe(1);
        expect(result.current.uploadProgress[0].status).toBe('failed');
      });
    });

    it('should clear all uploads', async () => {
      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({
          data: {
            attachmentGuid: 'attachment-1',
            filename: 'file1.pdf',
            contentType: 'application/pdf',
            size: 1024,
            url: 'https://example.com/file1.pdf',
          },
        })
        .mockRejectedValueOnce(new Error('Upload failed'));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
      ];

      await result.current.uploadFiles(files);

      await waitFor(() => {
        expect(result.current.uploadProgress.length).toBe(2);
      });

      result.current.clearAllUploads();

      await waitFor(() => {
        expect(result.current.uploadProgress.length).toBe(0);
      });
    });

    it('should track multiple concurrent uploads independently', async () => {
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;

      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      const secondPromise = new Promise((resolve) => {
        resolveSecond = resolve;
      });

      vi.mocked(apiClient.post)
        .mockReturnValueOnce(firstPromise as any)
        .mockReturnValueOnce(secondPromise as any);

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file1 = new File(['content1'], 'file1.pdf', { type: 'application/pdf' });
      const file2 = new File(['content2'], 'file2.pdf', { type: 'application/pdf' });

      result.current.uploadFile(file1);
      result.current.uploadFile(file2);

      await waitFor(() => {
        expect(result.current.uploadProgress.length).toBe(2);
        expect(result.current.uploadProgress[0].file).toBe(file1);
        expect(result.current.uploadProgress[1].file).toBe(file2);
      });

      // Resolve first upload
      resolveFirst!({
        data: {
          attachmentGuid: 'attachment-1',
          filename: 'file1.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/file1.pdf',
        },
      });

      await waitFor(() => {
        expect(result.current.uploadProgress[0].status).toBe('completed');
        expect(result.current.uploadProgress[1].status).toBe('uploading');
      });

      // Resolve second upload
      resolveSecond!({
        data: {
          attachmentGuid: 'attachment-2',
          filename: 'file2.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/file2.pdf',
        },
      });

      await waitFor(() => {
        expect(result.current.uploadProgress[0].status).toBe('completed');
        expect(result.current.uploadProgress[1].status).toBe('completed');
      });
    });
  });

  describe('API Request Configuration', () => {
    it('should set correct Content-Type header', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          attachmentGuid: 'attachment-123',
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          url: 'https://example.com/test.pdf',
        },
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      await result.current.uploadFile(file);

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
    });

    it('should configure progress callback', async () => {
      let hasProgressCallback = false;

      vi.mocked(apiClient.post).mockImplementation((_url, _data, config) => {
        hasProgressCallback = typeof config?.onUploadProgress === 'function';
        return Promise.resolve({
          data: {
            attachmentGuid: 'attachment-123',
            filename: 'test.pdf',
            contentType: 'application/pdf',
            size: 1024,
            url: 'https://example.com/test.pdf',
          },
        });
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      await result.current.uploadFile(file);

      expect(hasProgressCallback).toBe(true);
    });
  });
});
