/**
 * AttachmentUploadList Component
 *
 * Displays a list of files being uploaded with progress bars
 */

import { AttachmentUploadProgress, formatFileSize, isImageFile } from '../../types/attachment';

interface AttachmentUploadListProps {
  uploads: AttachmentUploadProgress[];
  onClearCompleted?: () => void;
  onInsertMarkdown?: (attachmentGuid: string, filename: string, isImage: boolean) => void;
}

export default function AttachmentUploadList({
  uploads,
  onClearCompleted,
  onInsertMarkdown,
}: AttachmentUploadListProps) {
  if (uploads.length === 0) {
    return null;
  }

  const hasCompleted = uploads.some(upload => upload.status === 'completed');

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Uploading Files ({uploads.length})
        </h4>
        {hasCompleted && onClearCompleted && (
          <button
            onClick={onClearCompleted}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear Completed
          </button>
        )}
      </div>

      {/* Upload Items */}
      <div className="space-y-2">
        {uploads.map((upload, index) => (
          <AttachmentUploadItem
            key={`${upload.file.name}-${index}`}
            upload={upload}
            onInsertMarkdown={onInsertMarkdown}
          />
        ))}
      </div>
    </div>
  );
}

interface AttachmentUploadItemProps {
  upload: AttachmentUploadProgress;
  onInsertMarkdown?: (attachmentGuid: string, filename: string, isImage: boolean) => void;
}

function AttachmentUploadItem({ upload, onInsertMarkdown }: AttachmentUploadItemProps) {
  const { file, progress, status, error, attachmentGuid } = upload;

  // Status icon and color
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'uploading':
        return (
          <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  const handleInsertMarkdown = () => {
    if (attachmentGuid && onInsertMarkdown) {
      onInsertMarkdown(attachmentGuid, file.name, isImageFile(file));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3">
      {/* File Info */}
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getStatusIcon()}
        </div>

        {/* File Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {file.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatFileSize(file.size)}
                {status === 'uploading' && ` • ${progress}%`}
              </p>
            </div>

            {/* Insert Markdown Button (for completed uploads) */}
            {status === 'completed' && onInsertMarkdown && attachmentGuid && (
              <button
                onClick={handleInsertMarkdown}
                className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap"
                title="Insert markdown reference into editor"
              >
                Insert
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {status === 'uploading' && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {status === 'failed' && error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {/* Success Message */}
          {status === 'completed' && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              Upload complete
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
