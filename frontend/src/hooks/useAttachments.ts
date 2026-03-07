/**
 * Attachment API Hook
 * 
 * Provides API methods for uploading and managing page attachments
 */

import { useState } from 'react';
import apiClient from '../config/api';
import { 
  AttachmentUploadResponse, 
  AttachmentUploadProgress,
  AttachmentValidationError,
  validateFile,
} from '../types/attachment';

/**
 * Hook for managing attachment uploads
 */
export function useAttachments(pageGuid: string) {
  const [uploadProgress, setUploadProgress] = useState<Map<string, AttachmentUploadProgress>>(new Map());

  /**
   * Upload a single file with progress tracking
   * @param file File to upload
   * @returns Promise with upload response
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
    const initialProgress: AttachmentUploadProgress = {
      file,
      progress: 0,
      status: 'pending',
    };
    setUploadProgress(prev => new Map(prev).set(uploadId, initialProgress));

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);

      // Update status to uploading
      setUploadProgress(prev => {
        const next = new Map(prev);
        const current = next.get(uploadId);
        if (current) {
          next.set(uploadId, { ...current, status: 'uploading' });
        }
        return next;
      });

      // Make the upload request with progress tracking
      const response = await apiClient.post<AttachmentUploadResponse>(
        `/pages/${pageGuid}/attachments`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => {
                const next = new Map(prev);
                const current = next.get(uploadId);
                if (current) {
                  next.set(uploadId, { ...current, progress: percentCompleted });
                }
                return next;
              });
            }
          },
        }
      );

      // Update to completed status
      setUploadProgress(prev => {
        const next = new Map(prev);
        next.set(uploadId, {
          file,
          progress: 100,
          status: 'completed',
          attachmentGuid: response.data.attachmentGuid,
          url: response.data.url,
        });
        return next;
      });

      return response.data;
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
   * @param files Array of files to upload
   * @returns Promise that resolves when all uploads complete
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
   * @returns Promise with array of attachment metadata
   */
  const listAttachments = async () => {
    const response = await apiClient.get(`/pages/${pageGuid}/attachments`);
    return response.data.attachments;
  };

  /**
   * Delete an attachment
   * @param attachmentGuid GUID of attachment to delete
   */
  const deleteAttachment = async (attachmentGuid: string) => {
    await apiClient.delete(`/pages/${pageGuid}/attachments/${attachmentGuid}`);
  };

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
