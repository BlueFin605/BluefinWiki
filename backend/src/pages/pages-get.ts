import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';

/**
 * Lambda: pages-get
 * GET /pages/{guid}
 * 
 * Retrieves a page by its GUID including all metadata.
 * 
 * Path Parameters:
 * - guid: Page GUID
 * 
 * Response:
 * {
 *   "guid": "page-guid",
 *   "title": "Page Title",
 *   "content": "# Markdown content",
 *   "folderId": "parent-guid-or-empty",
 *   "tags": ["tag1", "tag2"],
 *   "status": "published",
 *   "createdBy": "user-id",
 *   "modifiedBy": "user-id",
 *   "createdAt": "2026-02-06T12:00:00Z",
 *   "modifiedAt": "2026-02-06T12:00:00Z"
 * }
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
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

    // Get authenticated user context
    const user = getUserContext(event);

    // Get storage plugin instance
    const storagePlugin = getStoragePlugin();

    // Load page from storage
    const pageContent = await storagePlugin.loadPage(guid);

    // Log activity
    console.log('Page retrieved:', {
      guid,
      title: pageContent.title,
      requestedBy: user.userId,
      timestamp: new Date().toISOString(),
    });

    // Return page data
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageContent),
    };
  } catch (err: unknown) {
    console.error('Error retrieving page:', err);
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
      body: JSON.stringify({ error: 'Failed to retrieve page' }),
    };
  }
});
