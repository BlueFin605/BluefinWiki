/**
 * Attachment types for BlueFinWiki frontend.
 * Ported byte-for-byte from `frontend/src/types/attachment.ts` (React).
 */

export interface AttachmentMetadata {
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;
  checksum?: string;
}

export interface AttachmentUploadResponse {
  attachmentGuid: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

/**
 * Payload emitted by the attachment uploader's `uploaded` output on a
 * successful upload (step 4.9). Carries the stored filename plus the
 * ready-to-insert markdown, built once here via {@link buildAttachmentMarkdown}
 * so upload auto-insert shares the app's single attachment -> markdown builder
 * (no hand-rolled string in `inspector-panel` / `page-detail`).
 */
export interface AttachmentUploadedEvent {
  filename: string;
  markdown: string;
}

export interface AttachmentUploadProgress {
  file: File;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  attachmentGuid?: string;
  filename?: string;
  url?: string;
}

export interface AttachmentValidationError {
  file: File;
  error: string;
}

// File type categories with max sizes
export const FILE_LIMITS = {
  IMAGE: {
    maxSize: 10 * 1024 * 1024, // 10MB
    types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  },
  DOCUMENT: {
    maxSize: 50 * 1024 * 1024, // 50MB
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
  },
  VIDEO: {
    maxSize: 50 * 1024 * 1024, // 50MB
    types: ['video/mp4', 'video/webm', 'video/ogg'],
  },
  AUDIO: {
    maxSize: 50 * 1024 * 1024, // 50MB
    types: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
  },
} as const;

export const ALLOWED_MIME_TYPES = [
  ...FILE_LIMITS.IMAGE.types,
  ...FILE_LIMITS.DOCUMENT.types,
  ...FILE_LIMITS.VIDEO.types,
  ...FILE_LIMITS.AUDIO.types,
] as const;

/**
 * Validate a file before upload.
 * @param file File to validate
 * @returns Error message if invalid, null if valid
 */
export function validateFile(file: File): string | null {
  const allowedTypes = ALLOWED_MIME_TYPES as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    return `File type "${file.type}" is not supported`;
  }

  let maxSize: number;
  const imageTypes = FILE_LIMITS.IMAGE.types as readonly string[];
  const documentTypes = FILE_LIMITS.DOCUMENT.types as readonly string[];
  const videoTypes = FILE_LIMITS.VIDEO.types as readonly string[];
  const audioTypes = FILE_LIMITS.AUDIO.types as readonly string[];

  if (imageTypes.includes(file.type)) {
    maxSize = FILE_LIMITS.IMAGE.maxSize;
  } else if (documentTypes.includes(file.type)) {
    maxSize = FILE_LIMITS.DOCUMENT.maxSize;
  } else if (videoTypes.includes(file.type)) {
    maxSize = FILE_LIMITS.VIDEO.maxSize;
  } else if (audioTypes.includes(file.type)) {
    maxSize = FILE_LIMITS.AUDIO.maxSize;
  } else {
    maxSize = FILE_LIMITS.DOCUMENT.maxSize; // Default to document size
  }

  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return `File is too large. Maximum size for ${file.type} is ${maxSizeMB}MB`;
  }

  return null;
}

/**
 * Format file size for display.
 * @param bytes File size in bytes
 * @returns Formatted string (e.g. "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if file is an image.
 */
export function isImageFile(file: File): boolean {
  const imageTypes = FILE_LIMITS.IMAGE.types as readonly string[];
  return imageTypes.includes(file.type);
}

/**
 * Whether a stored attachment's content type is an image. Mirrors the
 * `image/` prefix test used by {@link buildAttachmentMarkdown}; the attachment
 * manager (step 4.8) uses it to decide whether to render a `WikiImage`
 * thumbnail + lightbox for a row.
 */
export function isImageContentType(contentType: string): boolean {
  return contentType.toLowerCase().startsWith('image/');
}

/**
 * A single emoji describing an attachment's kind, chosen from its content type
 * first and its filename extension as a fallback. Purely cosmetic — used for the
 * per-row type glyph in the attachment manager (step 4.8).
 */
export function attachmentEmoji(filename: string, contentType: string): string {
  const type = contentType.toLowerCase();
  const ext = (filename.split('.').pop() ?? '').toLowerCase();

  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type === 'application/pdf' || ext === 'pdf') return '📄';
  if (type.includes('word') || ext === 'doc' || ext === 'docx') return '📝';
  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    ext === 'xls' ||
    ext === 'xlsx' ||
    ext === 'csv'
  ) {
    return '📊';
  }
  if (
    type.includes('presentation') ||
    type.includes('powerpoint') ||
    ext === 'ppt' ||
    ext === 'pptx'
  ) {
    return '📽️';
  }
  if (type.startsWith('text/') || ext === 'txt' || ext === 'md') return '📃';
  if (
    type.includes('zip') ||
    type.includes('compressed') ||
    ext === 'zip' ||
    ext === 'gz' ||
    ext === 'tar' ||
    ext === 'rar' ||
    ext === '7z'
  ) {
    return '🗜️';
  }
  return '📎';
}

/**
 * Build the markdown for an uploaded/stored attachment. The single source of
 * truth for attachment → markdown across the app: the toolbar Attachment button
 * (step 3.4), the attachment manager's "Copy Markdown" / "Insert" actions
 * (step 4.8), and upload auto-insert (step 4.9) all call this.
 *
 * Ported from React's `EditorPane.buildMarkdownFromUpload`: image content types
 * become an `![alt](path)` embed with the extension stripped from the alt text;
 * everything else becomes a `[filename](path)` link. The path is the
 * URL-encoded filename so spaces / special characters don't break the link.
 */
export function buildAttachmentMarkdown(filename: string, contentType: string): string {
  const altText = filename.replace(/\.[^/.]+$/, '') || 'attachment';
  const isImage = contentType.toLowerCase().startsWith('image/');
  const path = encodeURIComponent(filename);
  return isImage ? `![${altText}](${path})` : `[${filename}](${path})`;
}
