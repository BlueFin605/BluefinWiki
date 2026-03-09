/**
 * AttachmentUploader Component
 *
 * Complete attachment upload interface combining file picker, drag-drop,
 * and upload progress display
 */

import { useState } from 'react';
import FileUpload from './FileUpload';
import AttachmentUploadList from './AttachmentUploadList';
import { useAttachments } from '../../hooks/useAttachments';

interface AttachmentUploaderProps {
  pageGuid: string;
  onUploadComplete?: (filename: string, url: string) => void;
  onInsertMarkdown?: (filename: string, isImage: boolean) => void;
  className?: string;
}

export default function AttachmentUploader({
  pageGuid,
  onUploadComplete,
  onInsertMarkdown,
  className = '',
}: AttachmentUploaderProps) {
  const {
    uploadFiles,
    uploadProgress,
    clearCompletedUploads,
  } = useAttachments(pageGuid);

  const [isUploading, setIsUploading] = useState(false);

  /**
   * Handle file selection from FileUpload component
   */
  const handleFilesSelected = async (files: File[]) => {
    setIsUploading(true);

    try {
      const { successful, failed } = await uploadFiles(files);

      // Notify parent of successful uploads
      if (onUploadComplete) {
        successful.forEach(upload => {
          onUploadComplete(upload.filename, upload.url);
        });
      }

      // Log failures (could also show a toast notification)
      if (failed.length > 0) {
        console.error('Failed uploads:', failed);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* File Upload Zone */}
      <FileUpload
        onFilesSelected={handleFilesSelected}
        disabled={isUploading}
        multiple={true}
      />

      {/* Upload Progress List */}
      {uploadProgress.length > 0 && (
        <AttachmentUploadList
          uploads={uploadProgress}
          onClearCompleted={clearCompletedUploads}
          onInsertMarkdown={onInsertMarkdown}
        />
      )}
    </div>
  );
}
