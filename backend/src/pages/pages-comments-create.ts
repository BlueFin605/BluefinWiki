import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { addComment } from './comments-service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CreateCommentRequestSchema = z.object({
  body: z.string().min(1, 'Comment body is required'),
  parentId: z.string().uuid().nullable().optional(),
});

/**
 * Lambda: pages-comments-create
 * POST /pages/{pageGuid}/comments
 *
 * Request Body:
 * {
 *   "body": "Comment text",
 *   "parentId": "top-level-comment-guid"  // optional — omit/null for a top-level comment
 * }
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

    if (!event.body) {
      return badRequest('Request body is required');
    }

    const parsed = JSON.parse(event.body);
    const validationResult = CreateCommentRequestSchema.safeParse(parsed);

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
    const comment = await addComment(
      pageGuid,
      validationResult.data,
      { authorId: user.userId, authorName: user.displayName }
    );

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    };
  } catch (err: unknown) {
    console.error('Error creating comment:', err);
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

    const message = err instanceof Error ? err.message : 'Failed to create comment';
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
