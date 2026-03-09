/**
 * Attachment types for BlueFinWiki frontend
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
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export interface AttachmentUploadProgress {
  file: File;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
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
 * Validate a file before upload
 * @param file File to validate
 * @returns Error message if invalid, null if valid
 */
export function validateFile(file: File): string | null {
  // Check if MIME type is allowed
  const allowedTypes = ALLOWED_MIME_TYPES as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    return `File type "${file.type}" is not supported`;
  }

  // Check file size based on type
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
 * Format file size for display
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if file is an image
 * @param file File to check
 * @returns true if image
 */
export function isImageFile(file: File): boolean {
  const imageTypes = FILE_LIMITS.IMAGE.types as readonly string[];
  return imageTypes.includes(file.type);
}
