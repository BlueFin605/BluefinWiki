import { APIGatewayProxyResult } from 'aws-lambda';
import { createHash } from 'crypto';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import {
  getBodyBuffer,
  getHeader,
  parseSingleMultipartFile,
  validateAttachment,
} from './attachments-utils.js';
import { AttachmentMetadata } from '../types/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Lambda: pages-attachments-upload
 * POST /pages/{pageGuid}/attachments
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const pageGuid = event.pathParameters?.pageGuid || event.pathParameters?.guid;

    if (!pageGuid) {
      return badRequest('Page GUID is required');
    }

    if (!UUID_REGEX.test(pageGuid)) {
      return badRequest('Invalid page GUID format');
    }

    const contentTypeHeader = getHeader(event.headers, 'content-type');
    if (!contentTypeHeader || !contentTypeHeader.toLowerCase().includes('multipart/form-data')) {
      return badRequest('Content-Type must be multipart/form-data');
    }

    const user = getUserContext(event);
    const bodyBuffer = getBodyBuffer(event);
    const parsedFile = parseSingleMultipartFile(bodyBuffer, contentTypeHeader);

    try {
      validateAttachment(parsedFile);
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : 'Invalid attachment';
      const isSizeError = message.toLowerCase().includes('file too large');
      return {
        statusCode: isSizeError ? 413 : 415,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: message }),
      };
    }

    const storagePlugin = getStoragePlugin();

    const uploaded = await storagePlugin.uploadAttachment(pageGuid, {
      originalFilename: parsedFile.filename,
      contentType: parsedFile.contentType,
      data: parsedFile.data,
      uploadedBy: user.userId,
    });

    const metadata: AttachmentMetadata = {
      attachmentId: uploaded.attachmentGuid,
      originalFilename: uploaded.filename,
      contentType: uploaded.contentType,
      size: uploaded.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.userId,
      checksum: createHash('sha256').update(parsedFile.data).digest('hex'),
    };

    await storagePlugin.saveAttachmentMetadata(pageGuid, uploaded.attachmentGuid, metadata);
    const url = await storagePlugin.getAttachmentUrl(pageGuid, uploaded.attachmentGuid);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachmentGuid: uploaded.attachmentGuid,
        filename: uploaded.filename,
        contentType: uploaded.contentType,
        size: uploaded.size,
        url,
      }),
    };
  } catch (err: unknown) {
    console.error('Error uploading attachment:', err);
    const error = err as { code?: string; statusCode?: number; message?: string };

    if (error.code) {
      return {
        statusCode: error.statusCode || 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          code: error.code,
        }),
      };
    }

    const message = err instanceof Error ? err.message : 'Failed to upload attachment';

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message }),
    };
  }
});

function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}
