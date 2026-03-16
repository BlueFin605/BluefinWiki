/**
 * Tests for useAttachments Hook
 *
 * Tests presigned URL upload flow, progress tracking, and error handling
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

// Mock axios for direct S3 PUT
vi.mock('axios', () => ({
  default: {
    put: vi.fn(),
  },
}));

import axios from 'axios';

/**
 * Helper: set up mocks for a successful presign→S3 PUT→confirm flow
 */
function mockSuccessfulUpload(overrides?: {
  filename?: string;
  contentType?: string;
  size?: number;
  url?: string;
}) {
  const filename = overrides?.filename ?? 'test.pdf';
  const contentType = overrides?.contentType ?? 'application/pdf';
  const size = overrides?.size ?? 1024;
  const url = overrides?.url ?? `test-page-123/${filename}`;

  // presign response
  vi.mocked(apiClient.post).mockResolvedValueOnce({
    data: {
      uploadUrl: 'https://s3.example.com/presigned-put-url',
      attachmentKey: `some-path/_attachments/${filename}`,
      filename,
    },
  });

  // S3 PUT
  vi.mocked(axios.put).mockResolvedValueOnce({ status: 200 });

  // confirm response
  vi.mocked(apiClient.post).mockResolvedValueOnce({
    data: { filename, contentType, size, url },
  });
}

describe('useAttachments Hook', () => {
  const testPageGuid = 'test-page-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file successfully via presigned URL flow', async () => {
      mockSuccessfulUpload();

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const response = await result.current.uploadFile(file);

      expect(response).toEqual({
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        url: 'test-page-123/test.pdf',
      });

      // Step 1: presign
      expect(apiClient.post).toHaveBeenCalledWith(
        `/pages/${testPageGuid}/attachments/presign`,
        { filename: 'test.pdf', contentType: 'application/pdf', size: file.size }
      );

      // Step 2: S3 PUT
      expect(axios.put).toHaveBeenCalledWith(
        'https://s3.example.com/presigned-put-url',
        file,
        expect.objectContaining({
          headers: { 'Content-Type': 'application/pdf' },
        })
      );

      // Step 3: confirm
      expect(apiClient.post).toHaveBeenCalledWith(
        `/pages/${testPageGuid}/attachments/confirm`,
        expect.objectContaining({
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: file.size,
        })
      );
    });

    it('should track upload progress through all steps', async () => {
      mockSuccessfulUpload();

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await result.current.uploadFile(file);

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress.length).toBe(1);
        expect(progress[0].status).toBe('completed');
        expect(progress[0].progress).toBe(100);
      });
    });

    it('should initialize upload progress tracking', async () => {
      mockSuccessfulUpload();

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

    it('should handle presign errors', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Presign failed'));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      await expect(result.current.uploadFile(file)).rejects.toThrow('Presign failed');

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress[0].status).toBe('failed');
        expect(progress[0].error).toBe('Presign failed');
      });
    });

    it('should handle S3 PUT errors', async () => {
      // presign succeeds
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          uploadUrl: 'https://s3.example.com/presigned-put-url',
          attachmentKey: 'key',
          filename: 'test.pdf',
        },
      });

      // S3 PUT fails
      vi.mocked(axios.put).mockRejectedValueOnce(new Error('S3 upload failed'));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      await expect(result.current.uploadFile(file)).rejects.toThrow('S3 upload failed');

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress[0].status).toBe('failed');
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

    it('should include filename and url in completed progress', async () => {
      mockSuccessfulUpload({
        filename: 'test.pdf',
        url: 'test-page-123/test.pdf',
      });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      await result.current.uploadFile(file);

      await waitFor(() => {
        const progress = result.current.uploadProgress;
        expect(progress[0].filename).toBe('test.pdf');
        expect(progress[0].url).toBe('test-page-123/test.pdf');
      });
    });
  });

  describe('uploadFiles (Multiple)', () => {
    it('should upload multiple files sequentially', async () => {
      // First file
      mockSuccessfulUpload({ filename: 'file1.pdf' });
      // Second file
      mockSuccessfulUpload({ filename: 'file2.png', contentType: 'image/png', size: 2048 });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.png', { type: 'image/png' }),
      ];

      const uploadResult = await result.current.uploadFiles(files);

      expect(uploadResult.successful).toHaveLength(2);
      expect(uploadResult.failed).toHaveLength(0);
      // 2 presign + 2 confirm = 4 apiClient.post calls
      expect(apiClient.post).toHaveBeenCalledTimes(4);
      expect(axios.put).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure', async () => {
      // First file succeeds
      mockSuccessfulUpload({ filename: 'file1.pdf' });
      // Second file: presign fails
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Upload failed'));

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
      ];

      const uploadResult = await result.current.uploadFiles(files);

      expect(uploadResult.successful).toHaveLength(1);
      expect(uploadResult.failed).toHaveLength(1);
      expect(uploadResult.failed[0].file).toBe(files[1]);
      expect(uploadResult.failed[0].error).toBe('Upload failed');
    });

    it('should continue uploading after one failure', async () => {
      // First file: presign fails
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('First upload failed'));
      // Second file succeeds
      mockSuccessfulUpload({ filename: 'file2.pdf' });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
      ];

      const uploadResult = await result.current.uploadFiles(files);

      expect(uploadResult.successful).toHaveLength(1);
      expect(uploadResult.failed).toHaveLength(1);
      expect(uploadResult.successful[0].filename).toBe('file2.pdf');
    });

    it('should validate all files before upload', async () => {
      mockSuccessfulUpload({ filename: 'valid.pdf' });

      const { result } = renderHook(() => useAttachments(testPageGuid));

      const files = [
        new File(['valid'], 'valid.pdf', { type: 'application/pdf' }),
        new File(['invalid'], 'bad.exe', { type: 'application/x-msdownload' }),
      ];

      const uploadResult = await result.current.uploadFiles(files);

      expect(uploadResult.successful).toHaveLength(1);
      expect(uploadResult.failed).toHaveLength(1);
      expect(uploadResult.failed[0].error).toContain('not supported');
      // Only valid file calls presign + confirm = 2 post calls
      expect(apiClient.post).toHaveBeenCalledTimes(2);
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

      const filename = 'attachment-to-delete';
      await result.current.deleteAttachment(filename);

      expect(apiClient.delete).toHaveBeenCalledWith(
        `/pages/${testPageGuid}/attachments/${filename}`
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
      mockSuccessfulUpload();

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
      // First file succeeds
      mockSuccessfulUpload({ filename: 'success.pdf' });
      // Second file: presign fails
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Upload failed'));

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
      // First file succeeds
      mockSuccessfulUpload({ filename: 'file1.pdf' });
      // Second file: presign fails
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Upload failed'));

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
  });
});
