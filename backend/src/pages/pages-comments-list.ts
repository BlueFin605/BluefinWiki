import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { listComments } from './comments-service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Lambda: pages-comments-list
 * GET /pages/{pageGuid}/comments
 *
 * Returns all comments for a page, flat (the frontend groups by parentId).
 * Soft-deleted comments are included with their body already blanked.
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

    const comments = await listComments(pageGuid);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments }),
    };
  } catch (err: unknown) {
    console.error('Error listing comments:', err);
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

    const message = err instanceof Error ? err.message : 'Failed to list comments';
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
