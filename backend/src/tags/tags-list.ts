import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { listTags, PAGE_TAGS_SCOPE } from './tags-service.js';

/**
 * Lambda: tags-list
 * GET /tags?scope={propertyName}
 *
 * Returns all tags for a given scope from the shared vocabulary, sorted alphabetically.
 * The scope parameter identifies which property's tags to return:
 * - "_page" for page-level tags
 * - A property name (e.g., "genre", "channel") for custom property tags
 *
 * If scope is omitted, defaults to "_page" for backward compatibility.
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const scope = event.queryStringParameters?.scope || PAGE_TAGS_SCOPE;
    const tags = await listTags(scope);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, scope }),
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
