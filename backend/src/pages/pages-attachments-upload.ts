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
      dimensions: extractImageDimensions(parsedFile.data, parsedFile.contentType),
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

function extractImageDimensions(
  data: Buffer,
  contentType: string
): { width: number; height: number } | undefined {
  try {
    if (contentType === 'image/png') {
      if (data.length >= 24) {
        const width = data.readUInt32BE(16);
        const height = data.readUInt32BE(20);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
      return undefined;
    }

    if (contentType === 'image/gif') {
      if (data.length >= 10) {
        const width = data.readUInt16LE(6);
        const height = data.readUInt16LE(8);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
      return undefined;
    }

    if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
      let offset = 2;
      while (offset + 9 < data.length) {
        if (data[offset] !== 0xFF) {
          offset += 1;
          continue;
        }

        const marker = data[offset + 1];
        const isStartOfFrame = marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker);
        if (isStartOfFrame) {
          const height = data.readUInt16BE(offset + 5);
          const width = data.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) {
            return { width, height };
          }
          return undefined;
        }

        const segmentLength = data.readUInt16BE(offset + 2);
        if (segmentLength <= 0) {
          break;
        }
        offset += segmentLength + 2;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}
