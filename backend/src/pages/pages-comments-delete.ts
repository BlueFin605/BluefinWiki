import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { deleteComment } from './comments-service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Lambda: pages-comments-delete
 * DELETE /pages/{pageGuid}/comments/{commentId}
 *
 * Only the comment's own author, or an Admin, may delete it (403 otherwise).
 * Soft-deletes (blanks the body, keeps the row) if the comment has replies;
 * otherwise removes it outright.
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const pageGuid = event.pathParameters?.pageGuid || event.pathParameters?.guid;
    const commentId = event.pathParameters?.commentId;

    if (!pageGuid || !commentId) {
      return badRequest('Page GUID and comment ID are required');
    }

    if (!UUID_REGEX.test(pageGuid) || !UUID_REGEX.test(commentId)) {
      return badRequest('Invalid GUID format');
    }

    const user = getUserContext(event);
    await deleteComment(pageGuid, commentId, user.userId, user.role === 'Admin');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err: unknown) {
    console.error('Error deleting comment:', err);
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

    const message = err instanceof Error ? err.message : 'Failed to delete comment';
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
