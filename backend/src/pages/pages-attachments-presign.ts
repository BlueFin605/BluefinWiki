import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PresignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

/**
 * Lambda: pages-attachments-presign
 * POST /pages/{pageGuid}/attachments/presign
 *
 * Returns a presigned S3 PUT URL so the client can upload directly to S3,
 * bypassing the API Gateway 10 MB payload limit.
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

    // Basic size guard (same limits as direct upload)
    const isImage = contentType.startsWith('image/');
    const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return json(413, { error: `File too large. Maximum size is ${maxMB}MB.` });
    }

    const storagePlugin = getStoragePlugin();
    const { uploadUrl, attachmentKey } = await storagePlugin.getAttachmentUploadUrl(
      pageGuid,
      filename,
      contentType,
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
