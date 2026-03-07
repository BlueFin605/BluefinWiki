import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Lambda: pages-attachments-download
 * GET /pages/{pageGuid}/attachments/{attachmentGuid}
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const pageGuid = event.pathParameters?.pageGuid || event.pathParameters?.guid;
    const attachmentGuid = event.pathParameters?.attachmentGuid;

    if (!pageGuid || !attachmentGuid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Page GUID and attachment GUID are required' }),
      };
    }

    if (!UUID_REGEX.test(pageGuid) || !UUID_REGEX.test(attachmentGuid)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid GUID format' }),
      };
    }

    const { getStoragePlugin } = await import('../storage/StoragePluginRegistry.js');
    const storagePlugin = getStoragePlugin();
    const downloadUrl = await storagePlugin.getAttachmentUrl(pageGuid, attachmentGuid);

    const response = await fetch(downloadUrl);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Attachment not found' }),
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    const contentDispositionHeader = response.headers.get('content-disposition');
    const filenameMatch = contentDispositionHeader?.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    const rawFilename = filenameMatch?.[1]?.replace(/"/g, '')?.trim();
    const filename = rawFilename && rawFilename.length > 0 ? decodeURIComponent(rawFilename) : `${attachmentGuid}`;

    const isInline = contentType.startsWith('image/') || contentType === 'application/pdf';

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${filename}"`,
      },
      body: buffer.toString('base64'),
    };
  } catch (err: unknown) {
    console.error('Error downloading attachment:', err);
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

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to download attachment' }),
    };
  }
});
