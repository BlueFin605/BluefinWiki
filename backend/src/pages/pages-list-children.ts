import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';

/**
 * Lambda: pages-list-children
 * GET /pages/children or GET /pages/{guid}/children
 * 
 * Lists all child pages of a parent page, or root-level pages if no parent specified.
 * 
 * Path Parameters:
 * - guid: Parent page GUID (optional, if not provided or "root", lists root pages)
 * 
 * Response:
 * {
 *   "parentGuid": "parent-guid-or-null",
 *   "children": [
 *     {
 *       "guid": "child-guid",
 *       "title": "Child Page Title",
 *       "parentGuid": "parent-guid",
 *       "status": "published",
 *       "modifiedAt": "2026-02-06T12:00:00Z",
 *       "modifiedBy": "user-id",
 *       "hasChildren": true
 *     }
 *   ]
 * }
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract parent GUID from path parameters
    // If not provided or "root", list root-level pages
    let parentGuid: string | null = event.pathParameters?.guid || null;

    if (parentGuid === 'root' || parentGuid === '') {
      parentGuid = null;
    }

    // Validate GUID format if provided
    if (parentGuid !== null) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(parentGuid)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid parent GUID format' }),
        };
      }
    }

    // Get authenticated user context
    const user = getUserContext(event);

    // Get storage plugin instance
    const storagePlugin = getStoragePlugin();

    // If parentGuid is provided, verify parent page exists
    if (parentGuid !== null) {
      try {
        await storagePlugin.loadPage(parentGuid);
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        if (error.code === 'PAGE_NOT_FOUND') {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Parent page not found' }),
          };
        }
        throw error;
      }
    }

    // List children
    const children = await storagePlugin.listChildren(parentGuid);

    // Log activity
    console.log('Children listed:', {
      parentGuid,
      childCount: children.length,
      requestedBy: user.userId,
      timestamp: new Date().toISOString(),
    });

    // Return children list
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentGuid,
        children,
        count: children.length,
      }),
    };
  } catch (err: unknown) {
    console.error('Error listing children:', err);
    const error = err as { code?: string; statusCode?: number; message?: string };

    // Handle storage plugin errors
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

    // Generic error response
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to list children' }),
    };
  }
});
