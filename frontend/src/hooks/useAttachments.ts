/**
 * Attachment API Hook
 *
 * Provides API methods for uploading and managing page attachments.
 * Uses presigned S3 URLs to bypass the API Gateway 10 MB payload limit.
 */

import { useState, useCallback } from 'react';
import axios from 'axios';
import apiClient from '../config/api';
import {
  AttachmentUploadResponse,
  AttachmentUploadProgress,
  AttachmentValidationError,
  validateFile,
} from '../types/attachment';

interface PresignResponse {
  uploadUrl: string;
  attachmentKey: string;
  filename: string;
}

/**
 * Hook for managing attachment uploads
 */
export function useAttachments(pageGuid: string) {
  const [uploadProgress, setUploadProgress] = useState<Map<string, AttachmentUploadProgress>>(new Map());

  /**
   * Upload a single file via presigned S3 URL with progress tracking
   */
  const uploadFile = async (file: File): Promise<AttachmentUploadResponse> => {
    // Validate file first
    const validationError = validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    // Create a unique ID for this upload
    const uploadId = `${file.name}-${Date.now()}`;

    // Initialize progress tracking
    setUploadProgress(prev => new Map(prev).set(uploadId, {
      file,
      progress: 0,
      status: 'pending',
    }));

    try {
      // Step 1: Get presigned URL from our API
      setUploadProgress(prev => {
        const next = new Map(prev);
        const current = next.get(uploadId);
        if (current) {
          next.set(uploadId, { ...current, status: 'uploading', progress: 5 });
        }
        return next;
      });

      const presignResponse = await apiClient.post<PresignResponse>(
        `/pages/${pageGuid}/attachments/presign`,
        {
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }
      );

      const { uploadUrl, attachmentKey, filename } = presignResponse.data;

      // Step 2: Upload directly to S3 using the presigned URL
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            // Map 10-90% range for the S3 upload portion
            const s3Progress = Math.round((progressEvent.loaded * 80) / progressEvent.total);
            setUploadProgress(prev => {
              const next = new Map(prev);
              const current = next.get(uploadId);
              if (current) {
                next.set(uploadId, { ...current, progress: 10 + s3Progress });
              }
              return next;
            });
          }
        },
      });

      // Step 3: Confirm upload with our API (saves metadata)
      setUploadProgress(prev => {
        const next = new Map(prev);
        const current = next.get(uploadId);
        if (current) {
          next.set(uploadId, { ...current, progress: 95 });
        }
        return next;
      });

      const confirmResponse = await apiClient.post<AttachmentUploadResponse>(
        `/pages/${pageGuid}/attachments/confirm`,
        {
          filename,
          contentType: file.type,
          size: file.size,
          attachmentKey,
        }
      );

      // Update to completed status
      setUploadProgress(prev => {
        const next = new Map(prev);
        next.set(uploadId, {
          file,
          progress: 100,
          status: 'completed',
          filename: confirmResponse.data.filename,
          url: confirmResponse.data.url,
        });
        return next;
      });

      return confirmResponse.data;
    } catch (error: unknown) {
      // Update to failed status
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadProgress(prev => {
        const next = new Map(prev);
        const current = next.get(uploadId);
        if (current) {
          next.set(uploadId, {
            ...current,
            status: 'failed',
            error: errorMessage,
          });
        }
        return next;
      });
      throw error;
    }
  };

  /**
   * Upload multiple files with progress tracking
   */
  const uploadFiles = async (files: File[]): Promise<{
    successful: AttachmentUploadResponse[];
    failed: AttachmentValidationError[];
  }> => {
    const successful: AttachmentUploadResponse[] = [];
    const failed: AttachmentValidationError[] = [];

    // Upload files sequentially to avoid overwhelming the server
    for (const file of files) {
      try {
        const response = await uploadFile(file);
        successful.push(response);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        failed.push({
          file,
          error: errorMessage,
        });
      }
    }

    return { successful, failed };
  };

  /**
   * List all attachments for the page
   */
  const listAttachments = useCallback(async () => {
    const response = await apiClient.get(`/pages/${pageGuid}/attachments`);
    return response.data.attachments;
  }, [pageGuid]);

  /**
   * Delete an attachment
   */
  const deleteAttachment = useCallback(async (filename: string) => {
    await apiClient.delete(`/pages/${pageGuid}/attachments/${encodeURIComponent(filename)}`);
  }, [pageGuid]);

  /**
   * Clear completed uploads from progress tracking
   */
  const clearCompletedUploads = () => {
    setUploadProgress(prev => {
      const next = new Map(prev);
      for (const [id, upload] of next.entries()) {
        if (upload.status === 'completed') {
          next.delete(id);
        }
      }
      return next;
    });
  };

  /**
   * Clear all upload progress
   */
  const clearAllUploads = () => {
    setUploadProgress(new Map());
  };

  return {
    uploadFile,
    uploadFiles,
    listAttachments,
    deleteAttachment,
    uploadProgress: Array.from(uploadProgress.values()),
    clearCompletedUploads,
    clearAllUploads,
  };
}
