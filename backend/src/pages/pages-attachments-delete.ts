import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Lambda: pages-attachments-delete
 * DELETE /pages/{pageGuid}/attachments/{attachmentGuid}
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const pageGuid = event.pathParameters?.pageGuid || event.pathParameters?.guid;
    const attachmentGuid = event.pathParameters?.attachmentGuid;

    if (!pageGuid || !attachmentGuid) {
      return badRequest('Page GUID and attachment GUID are required');
    }

    if (!UUID_REGEX.test(pageGuid) || !UUID_REGEX.test(attachmentGuid)) {
      return badRequest('Invalid GUID format');
    }

    const storagePlugin = getStoragePlugin();
    await storagePlugin.deleteAttachment(pageGuid, attachmentGuid);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Attachment deleted successfully',
      }),
    };
  } catch (err: unknown) {
    console.error('Error deleting attachment:', err);
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

    const message = err instanceof Error ? err.message : 'Failed to delete attachment';
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
