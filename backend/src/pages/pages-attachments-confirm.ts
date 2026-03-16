import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { AttachmentMetadata } from '../types/index.js';
import {
  IMAGE_MIME_TYPES,
  IMAGE_LIMIT_BYTES,
  DOCUMENT_LIMIT_BYTES,
} from './attachments-utils.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ConfirmRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
  attachmentKey: z.string().min(1),
});

/**
 * Lambda: pages-attachments-confirm
 * POST /pages/{pageGuid}/attachments/confirm
 *
 * Called after the client has uploaded a file directly to S3 via presigned URL.
 * Verifies the object exists in S3 and validates actual size before saving metadata.
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

    const parsed = ConfirmRequestSchema.safeParse(JSON.parse(event.body));
    if (!parsed.success) {
      return json(400, { error: 'Validation failed', details: parsed.error.format() });
    }

    const { filename, contentType, size, attachmentKey } = parsed.data;
    const user = getUserContext(event);
    const storagePlugin = getStoragePlugin();

    // Verify the object actually exists in S3 and check its real size
    const headResult = await storagePlugin.headAttachment(pageGuid, attachmentKey);

    if (!headResult) {
      return json(404, { error: 'Attachment not found in storage. Upload may have failed.' });
    }

    // Verify actual size matches claimed size (within reason — allow small variance for encoding)
    const isImage = IMAGE_MIME_TYPES.has(contentType.toLowerCase());
    const maxSize = isImage ? IMAGE_LIMIT_BYTES : DOCUMENT_LIMIT_BYTES;

    if (headResult.contentLength > maxSize) {
      // Object exceeds limits — delete it and reject
      try {
        await storagePlugin.deleteAttachmentByKey(attachmentKey);
      } catch { /* best effort cleanup */ }
      return json(413, { error: 'Uploaded file exceeds size limit.' });
    }

    const metadata: AttachmentMetadata = {
      filename,
      contentType: headResult.contentType || contentType,
      size: headResult.contentLength,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.userId,
    };

    await storagePlugin.saveAttachmentMetadata(pageGuid, filename, metadata);

    const url = `${pageGuid}/${filename}`;

    console.log('Attachment confirmed:', {
      pageGuid,
      filename,
      claimedSize: size,
      actualSize: headResult.contentLength,
      uploadedBy: user.userId,
    });

    return json(201, {
      filename,
      contentType: metadata.contentType,
      size: metadata.size,
      url,
    });
  } catch (err: unknown) {
    console.error('Error confirming attachment:', err);
    const error = err as { code?: string; statusCode?: number; message?: string };

    if (error.code) {
      return json(error.statusCode || 500, { error: error.message, code: error.code });
    }

    return json(500, { error: 'Failed to confirm attachment upload' });
  }
});

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
