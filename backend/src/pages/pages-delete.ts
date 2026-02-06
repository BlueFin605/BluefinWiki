import { APIGatewayProxyResult, Context } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';

/**
 * Lambda: pages-delete
 * DELETE /pages/{guid}
 * 
 * Deletes a page and optionally all its children.
 * 
 * Path Parameters:
 * - guid: Page GUID
 * 
 * Query Parameters:
 * - recursive: true|false (default: false)
 *   - true: Delete page and all children recursively
 *   - false: Only delete if page has no children
 * 
 * Response:
 * {
 *   "guid": "page-guid",
 *   "deleted": true,
 *   "deletedCount": 5  // Number of pages deleted (including children if recursive)
 * }
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract GUID from path parameters
    const guid = event.pathParameters?.guid;

    if (!guid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Page GUID is required' }),
      };
    }

    // Validate GUID format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guid)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid GUID format' }),
      };
    }

    // Get recursive parameter from query string
    const recursive = event.queryStringParameters?.recursive === 'true';

    // Get authenticated user context
    const user = getUserContext(event);

    // Verify user has permission to delete
    // For MVP, only Admin users can delete pages
    if (user.role !== 'Admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Only Admin users can delete pages' }),
      };
    }

    // Get storage plugin instance
    const storagePlugin = getStoragePlugin();

    // Check if page exists
    try {
      await storagePlugin.loadPage(guid);
    } catch (error: any) {
      if (error.code === 'PAGE_NOT_FOUND') {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Page not found' }),
        };
      }
      throw error;
    }

    // Count children before deletion (for reporting)
    let deletedCount = 1; // The page itself
    if (recursive) {
      try {
        const children = await storagePlugin.listChildren(guid);
        // Recursive deletion will handle nested children
        // This is a rough estimate for reporting
        deletedCount += children.length;
      } catch (error) {
        // If listing children fails, still proceed with deletion
        console.warn('Could not count children before deletion:', error);
      }
    }

    // Delete page
    await storagePlugin.deletePage(guid, recursive);

    // Log activity
    console.log('Page deleted:', {
      guid,
      recursive,
      deletedBy: user.userId,
      timestamp: new Date().toISOString(),
      deletedCount,
    });

    // Return success response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guid,
        deleted: true,
        recursive,
        deletedCount,
      }),
    };
  } catch (error: any) {
    console.error('Error deleting page:', error);

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
      body: JSON.stringify({ error: 'Failed to delete page' }),
    };
  }
});
