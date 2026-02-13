import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { getBacklinks } from './link-extraction.js';

/**
 * Lambda: pages-backlinks
 * GET /pages/{guid}/backlinks
 * 
 * Retrieves all pages that link to the specified page (backlinks).
 * Returns page metadata for each linking page.
 * 
 * Path Parameters:
 * - guid: Target page GUID to find backlinks for
 * 
 * Response:
 * {
 *   "guid": "target-page-guid",
 *   "backlinks": [
 *     {
 *       "guid": "source-page-guid",
 *       "title": "Source Page Title",
 *       "linkText": "Link text used",
 *       "createdAt": "2026-02-06T12:00:00Z"
 *     }
 *   ],
 *   "count": 1
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

    // Get storage plugin instance
    const storagePlugin = getStoragePlugin();

    // Verify target page exists
    try {
      await storagePlugin.loadPage(guid);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'PAGE_NOT_FOUND') {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Page not found' }),
        };
      }
      throw error;
    }

    // Get backlinks from page_links table
    const backlinkRecords = await getBacklinks(guid);

    // Load metadata for each linking page
    const backlinks = await Promise.all(
      backlinkRecords.map(async (record) => {
        try {
          const sourcePage = await storagePlugin.loadPage(record.sourceGuid);
          return {
            guid: record.sourceGuid,
            title: sourcePage.title,
            linkText: record.linkText || '',
            createdAt: record.createdAt,
          };
        } catch (err: unknown) {
          const error = err as { code?: string };
          // If source page is deleted, skip it
          if (error.code === 'PAGE_NOT_FOUND') {
            return null;
          }
          throw err;
        }
      })
    );

    // Filter out null entries (deleted pages)
    const validBacklinks = backlinks.filter((link) => link !== null);

    // Return backlinks response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guid,
        backlinks: validBacklinks,
        count: validBacklinks.length,
      }),
    };
  } catch (err: unknown) {
    console.error('Error retrieving backlinks:', err);
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
      body: JSON.stringify({ error: 'Failed to retrieve backlinks' }),
    };
  }
});
