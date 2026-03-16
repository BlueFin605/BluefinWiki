import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { AttachmentMetadata } from '../types/index.js';

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
 * Saves attachment metadata sidecar JSON.
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

    const { filename, contentType, size } = parsed.data;
    const user = getUserContext(event);
    const storagePlugin = getStoragePlugin();

    const metadata: AttachmentMetadata = {
      filename,
      contentType,
      size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.userId,
    };

    await storagePlugin.saveAttachmentMetadata(pageGuid, filename, metadata);

    const url = `${pageGuid}/${filename}`;

    console.log('Attachment confirmed:', { pageGuid, filename, size, uploadedBy: user.userId });

    return json(201, {
      filename,
      contentType,
      size,
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
