import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import {
  IMAGE_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  IMAGE_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  IMAGE_LIMIT_BYTES,
  DOCUMENT_LIMIT_BYTES,
} from './attachments-utils.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PresignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot < 0 ? '' : filename.slice(lastDot).toLowerCase();
}

/**
 * Lambda: pages-attachments-presign
 * POST /pages/{pageGuid}/attachments/presign
 *
 * Validates file type and size, then returns a presigned S3 PUT URL
 * so the client can upload directly to S3.
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const pageGuid = event.pathParameters?.pageGuid || event.pathParameters?.guid;

    if (!pageGuid || !UUID_REGEX.test(pageGuid)) {
      return json(400, { error: 'Valid page GUID is required' });
    }

    if (!event.body) {
      return json(400, { error: 'Request body is required' });
    }

    const parsed = PresignRequestSchema.safeParse(JSON.parse(event.body));
    if (!parsed.success) {
      return json(400, { error: 'Validation failed', details: parsed.error.format() });
    }

    const { filename, contentType, size } = parsed.data;
    const extension = getExtension(filename);
    const lowerContentType = contentType.toLowerCase();

    // Validate file type against allowlist (same rules as direct upload)
    const isImage = IMAGE_MIME_TYPES.has(lowerContentType) || IMAGE_EXTENSIONS.has(extension);
    const isDocument = DOCUMENT_MIME_TYPES.has(lowerContentType) || DOCUMENT_EXTENSIONS.has(extension);

    if (!isImage && !isDocument) {
      return json(415, { error: 'Unsupported file type. Allowed types: images, PDF, and office documents.' });
    }

    // Enforce size limits
    const maxSize = isImage ? IMAGE_LIMIT_BYTES : DOCUMENT_LIMIT_BYTES;
    if (size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return json(413, { error: `File too large. Maximum size is ${maxMB}MB.` });
    }

    const storagePlugin = getStoragePlugin();
    const { uploadUrl, attachmentKey } = await storagePlugin.getAttachmentUploadUrl(
      pageGuid,
      filename,
      lowerContentType,
      size,
    );

    return json(200, { uploadUrl, attachmentKey, filename });
  } catch (err: unknown) {
    console.error('Error generating presigned URL:', err);
    const error = err as { code?: string; statusCode?: number; message?: string };

    if (error.code) {
      return json(error.statusCode || 500, { error: error.message, code: error.code });
    }

    return json(500, { error: 'Failed to generate upload URL' });
  }
});

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
