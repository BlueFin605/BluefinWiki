import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttachmentMetadata, formatFileSize } from '../../types/attachment';
import { useAttachments } from '../../hooks/useAttachments';
import apiClient from '../../config/api';

interface AttachmentManagerProps {
  pageGuid: string;
  currentUserId?: string;
  currentUserRole?: 'Admin' | 'Standard';
  pageAuthorId?: string;
  onInsertMarkdown?: (markdown: string) => void;
  className?: string;
}

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function isImageContentType(contentType: string): boolean {
  return IMAGE_MIME_TYPES.has(contentType.toLowerCase());
}

function getFileTypeIcon(contentType: string): string {
  const type = contentType.toLowerCase();
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📄';
  if (type.includes('spreadsheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📽️';
  if (type.includes('word')) return '📝';
  if (type.startsWith('audio/')) return '🎵';
  if (type.startsWith('video/')) return '🎬';
  return '📎';
}

function formatUploadedDate(uploadedAt: string): string {
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) {
    return uploadedAt;
  }
  return date.toLocaleString();
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  pageGuid,
  currentUserId,
  currentUserRole,
  pageAuthorId,
  onInsertMarkdown,
  className,
}) => {
  const { listAttachments, deleteAttachment } = useAttachments(pageGuid);

  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentMetadata | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const objectUrlRegistry = useRef<Set<string>>(new Set());

  const canDeleteAttachment = useCallback((attachment: AttachmentMetadata): boolean => {
    if (!currentUserId) {
      return false;
    }

    const isAdmin = currentUserRole === 'Admin';
    const isPageAuthor = pageAuthorId === currentUserId;
    const isAttachmentAuthor = attachment.uploadedBy === currentUserId;

    return isAdmin || isPageAuthor || isAttachmentAuthor;
  }, [currentUserId, currentUserRole, pageAuthorId]);

  const downloadPathFor = useCallback((attachmentId: string) => {
    return `/pages/${pageGuid}/attachments/${attachmentId}`;
  }, [pageGuid]);

  const fetchAttachmentBlobUrl = useCallback(async (attachmentId: string): Promise<string> => {
    const response = await apiClient.get(downloadPathFor(attachmentId), {
      responseType: 'blob',
    });

    const url = URL.createObjectURL(response.data as Blob);
    objectUrlRegistry.current.add(url);
    return url;
  }, [downloadPathFor]);

  const loadAttachments = useCallback(async (retryAttempt = 0) => {
    setIsLoading(true);
    setError(null);

    try {
      const data: AttachmentMetadata[] = await listAttachments();
      setAttachments(data);
      setRetryCount(0); // Reset retry count on success
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load attachments';
      setError(message);
      setRetryCount(retryAttempt + 1);
      
      // Log the error with retry information
      console.error(`Failed to load attachments (attempt ${retryAttempt + 1}):`, message);
    } finally {
      setIsLoading(false);
    }
  }, [listAttachments]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let mounted = true;

    const loadWithBackoff = async () => {
      // Maximum retry attempts before giving up (10 retries = ~17 minutes total)
      const maxRetries = 10;
      
      if (retryCount >= maxRetries) {
        console.error(`Max retry attempts (${maxRetries}) reached. Stopping automatic retries.`);
        return;
      }

      // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, max 30s
      const baseDelay = 1000; // 1 second
      const maxDelay = 30000; // 30 seconds
      const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

      // If this is a retry, wait before loading
      if (retryCount > 0) {
        console.log(`Retrying attachment load in ${delay / 1000}s (attempt ${retryCount + 1}/${maxRetries})...`);
        timeoutId = setTimeout(() => {
          if (mounted) {
            loadAttachments(retryCount);
          }
        }, delay);
      } else {
        // First load, no delay
        loadAttachments(0);
      }
    };

    loadWithBackoff();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loadAttachments, retryCount]);

  useEffect(() => {
    const imageAttachments = attachments.filter((attachment) => isImageContentType(attachment.contentType));
    const missingImageIds = imageAttachments
      .map((attachment) => attachment.attachmentId)
      .filter((attachmentId) => !imageUrls[attachmentId]);

    if (missingImageIds.length === 0) {
      return;
    }

    let cancelled = false;

    const fetchMissingImages = async () => {
      for (const attachmentId of missingImageIds) {
        try {
          const url = await fetchAttachmentBlobUrl(attachmentId);
          if (!cancelled) {
            setImageUrls((prev) => ({ ...prev, [attachmentId]: url }));
          }
        } catch {
          if (!cancelled) {
            setImageUrls((prev) => ({ ...prev, [attachmentId]: '' }));
          }
        }
      }
    };

    fetchMissingImages();

    return () => {
      cancelled = true;
    };
  }, [attachments, imageUrls, fetchAttachmentBlobUrl]);

  useEffect(() => {
    return () => {
      for (const url of objectUrlRegistry.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlRegistry.current.clear();
    };
  }, []);

  const sortedAttachments = useMemo(() => {
    return [...attachments].sort((left, right) => {
      return new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime();
    });
  }, [attachments]);

  const handleDownload = useCallback(async (attachment: AttachmentMetadata) => {
    setActionError(null);

    try {
      const response = await apiClient.get(downloadPathFor(attachment.attachmentId), {
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(response.data as Blob);
      objectUrlRegistry.current.add(blobUrl);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.originalFilename;
      link.click();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download attachment';
      setActionError(message);
    }
  }, [downloadPathFor]);

  const handleDelete = useCallback(async (attachment: AttachmentMetadata) => {
    if (!canDeleteAttachment(attachment)) {
      setActionError('You do not have permission to delete this attachment.');
      return;
    }

    const confirmed = window.confirm(`Delete attachment "${attachment.originalFilename}"?`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setDeletingId(attachment.attachmentId);

    try {
      await deleteAttachment(attachment.attachmentId);
      setAttachments((prev) => prev.filter((item) => item.attachmentId !== attachment.attachmentId));

      if (previewAttachment?.attachmentId === attachment.attachmentId) {
        setPreviewAttachment(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete attachment';
      setActionError(message);
    } finally {
      setDeletingId(null);
    }
  }, [canDeleteAttachment, deleteAttachment, previewAttachment]);

  const openPreview = useCallback((attachment: AttachmentMetadata) => {
    if (!isImageContentType(attachment.contentType)) {
      return;
    }
    setPreviewAttachment(attachment);
  }, []);

  const buildMarkdownLink = useCallback((attachment: AttachmentMetadata) => {
    const attachmentUrl = `/pages/${pageGuid}/attachments/${attachment.attachmentId}`;
    const isImage = isImageContentType(attachment.contentType);
    const altText = attachment.originalFilename.replace(/\.[^/.]+$/, '') || 'attachment';

    if (isImage) {
      return `![${altText}](${attachmentUrl})`;
    }

    return `[${attachment.originalFilename}](${attachmentUrl})`;
  }, [pageGuid]);

  const copyMarkdownToClipboard = useCallback(async (attachment: AttachmentMetadata) => {
    const markdown = buildMarkdownLink(attachment);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = markdown;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to copy markdown link';
      setActionError(message);
    }
  }, [buildMarkdownLink]);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLButtonElement>, attachment: AttachmentMetadata) => {
    const markdown = buildMarkdownLink(attachment);
    event.dataTransfer.setData('text/plain', markdown);
    event.dataTransfer.effectAllowed = 'copy';
  }, [buildMarkdownLink]);

  const insertMarkdownLink = useCallback((attachment: AttachmentMetadata) => {
    if (!onInsertMarkdown) {
      return;
    }

    onInsertMarkdown(buildMarkdownLink(attachment));
  }, [buildMarkdownLink, onInsertMarkdown]);

  const handleManualRefresh = useCallback(() => {
    setRetryCount(0); // Reset retry count for manual refresh
    loadAttachments(0);
  }, [loadAttachments]);

  return (
    <div className={`bg-white dark:bg-gray-800 flex flex-col h-full ${className || ''}`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Attachments</h3>
        <button
          onClick={handleManualRefresh}
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          type="button"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Copy a markdown link or drag it into the editor.
        </p>

        {isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading attachments...</p>
        )}

        {!isLoading && error && (
          <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
            <p className="font-medium">{error}</p>
            {retryCount > 0 && retryCount < 10 && (
              <p className="mt-1 text-xs">Retrying automatically (attempt {retryCount}/10)...</p>
            )}
            {retryCount >= 10 && (
              <p className="mt-1 text-xs">Max retry attempts reached. Click "Refresh" to try again manually.</p>
            )}
          </div>
        )}

        {!isLoading && !error && sortedAttachments.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No attachments uploaded for this page.</p>
        )}

        {!isLoading && !error && sortedAttachments.length > 0 && (
          <ul className="space-y-3">
            {sortedAttachments.map((attachment) => {
              const canDelete = canDeleteAttachment(attachment);
              const previewUrl = imageUrls[attachment.attachmentId];
              const isImage = isImageContentType(attachment.contentType);

              return (
                <li
                  key={attachment.attachmentId}
                  className="border border-gray-200 dark:border-gray-700 rounded-md p-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg leading-none mt-0.5" aria-hidden="true">
                      {getFileTypeIcon(attachment.contentType)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {attachment.originalFilename}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatFileSize(attachment.size)} • {formatUploadedDate(attachment.uploadedAt)}
                      </p>

                      {isImage && previewUrl && (
                        <button
                          type="button"
                          className="mt-2 block"
                          onClick={() => openPreview(attachment)}
                          title="Open full-size preview"
                        >
                          <img
                            src={previewUrl}
                            alt={attachment.originalFilename}
                            className="h-16 w-16 rounded object-cover border border-gray-200 dark:border-gray-700"
                          />
                        </button>
                      )}

                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleDownload(attachment)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          title={downloadPathFor(attachment.attachmentId)}
                        >
                          Download
                        </button>

                        <button
                          type="button"
                          onClick={() => copyMarkdownToClipboard(attachment)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Copy Markdown
                        </button>

                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => handleDragStart(event, attachment)}
                          className="text-xs text-gray-600 dark:text-gray-300 hover:underline cursor-grab active:cursor-grabbing"
                        >
                          Drag Link
                        </button>

                        {onInsertMarkdown && (
                          <button
                            type="button"
                            onClick={() => insertMarkdownLink(attachment)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Insert
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(attachment)}
                            disabled={deletingId === attachment.attachmentId}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                          >
                            {deletingId === attachment.attachmentId ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {actionError && (
          <div className="mt-3 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
            {actionError}
          </div>
        )}
      </div>

      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center">
            <button
              type="button"
              onClick={() => setPreviewAttachment(null)}
              className="absolute top-2 right-2 bg-black/70 text-white rounded px-3 py-1 text-sm hover:bg-black"
            >
              Close
            </button>
            {imageUrls[previewAttachment.attachmentId] && (
              <img
                src={imageUrls[previewAttachment.attachmentId]}
                alt={previewAttachment.originalFilename}
                className="max-h-[85vh] max-w-full object-contain rounded"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentManager;