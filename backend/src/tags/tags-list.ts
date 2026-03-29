import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { listTags } from './tags-service.js';

/**
 * Lambda: tags-list
 * GET /tags
 *
 * Returns all tags from the shared vocabulary, sorted alphabetically.
 */
export const handler = withAuth(async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const tags = await listTags();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    };
  } catch (err: unknown) {
    console.error('Error listing tags:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to list tags' }),
    };
  }
});
