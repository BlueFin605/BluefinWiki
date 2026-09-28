import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { updateComment } from './comments-service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UpdateCommentRequestSchema = z.object({
  body: z.string().min(1, 'Comment body is required'),
});

/**
 * Lambda: pages-comments-update
 * PUT /pages/{pageGuid}/comments/{commentId}
 *
 * Only the comment's own author may edit it (403 otherwise).
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

    if (!event.body) {
      return badRequest('Request body is required');
    }

    const parsed = JSON.parse(event.body);
    const validationResult = UpdateCommentRequestSchema.safeParse(parsed);

    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Validation failed',
          details: validationResult.error.format(),
        }),
      };
    }

    const user = getUserContext(event);
    const comment = await updateComment(pageGuid, commentId, validationResult.data.body, user.userId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    };
  } catch (err: unknown) {
    console.error('Error updating comment:', err);
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

    const message = err instanceof Error ? err.message : 'Failed to update comment';
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
