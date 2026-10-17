import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';

/**
 * Lambda: pages-ancestors
 * GET /pages/{guid}/ancestors
 *
 * Returns the ancestor chain for a page (root first, immediate parent last).
 * Used for breadcrumb navigation.
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const guid = event.pathParameters?.guid;

    if (!guid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Page GUID is required' }),
      };
    }

    const storagePlugin = getStoragePlugin();

    // getAncestors swallows a missing page and returns [], so check existence
    // first: an unknown guid is a 404, not a page with no ancestors.
    try {
      await storagePlugin.loadPage(guid);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'PAGE_NOT_FOUND') {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Page not found' }),
        };
      }
      throw err;
    }

    const ancestors = await storagePlugin.getAncestors(guid);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guid, ancestors }),
    };
  } catch (err: unknown) {
    console.error('Error retrieving ancestors:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to retrieve ancestors' }),
    };
  }
});
