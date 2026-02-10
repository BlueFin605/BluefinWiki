import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import type { StoragePlugin } from '../storage/StoragePlugin.js';

// Request validation schema
const MovePageRequestSchema = z.object({
  newParentGuid: z.string().uuid().nullable(),
});

/**
 * Lambda: pages-move
 * PUT /pages/{guid}/move
 * 
 * Moves a page to a new parent location (or to root level).
 * Prevents circular references (page cannot be moved under its own descendant).
 * 
 * Path Parameters:
 * - guid: Page GUID to move
 * 
 * Request Body:
 * {
 *   "newParentGuid": "new-parent-guid-or-null"
 * }
 * 
 * Response:
 * {
 *   "guid": "page-guid",
 *   "newParentGuid": "new-parent-guid-or-null",
 *   "movedAt": "2026-02-06T12:00:00Z"
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

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validationResult = MovePageRequestSchema.safeParse(body);

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

    const { newParentGuid } = validationResult.data;

    // Get authenticated user context
    const user = getUserContext(event);

    // Get storage plugin instance
    const storagePlugin = getStoragePlugin();

    // Verify page exists
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

    // If newParentGuid is provided, verify it exists
    if (newParentGuid !== null) {
      try {
        await storagePlugin.loadPage(newParentGuid);
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        if (error.code === 'PAGE_NOT_FOUND') {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Target parent page not found' }),
          };
        }
        throw error;
      }
    }

    // Prevent moving page to itself
    if (newParentGuid === guid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Cannot move page to itself' }),
      };
    }

    // Check for circular reference: newParentGuid cannot be a descendant of guid
    if (newParentGuid !== null) {
      const isDescendant = await checkIfDescendant(storagePlugin, guid, newParentGuid);
      if (isDescendant) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'Cannot move page under its own descendant (circular reference)' 
          }),
        };
      }
    }

    // Move page
    await storagePlugin.movePage(guid, newParentGuid);

    const now = new Date().toISOString();

    // Log activity
    console.log('Page moved:', {
      guid,
      newParentGuid,
      movedBy: user.userId,
      timestamp: now,
    });

    // Return success response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guid,
        newParentGuid,
        movedAt: now,
      }),
    };
  } catch (err: unknown) {
    console.error('Error moving page:', err);
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
      body: JSON.stringify({ error: 'Failed to move page' }),
    };
  }
});

/**
 * Check if targetGuid is a descendant of ancestorGuid
 * This prevents circular references when moving pages
 */
async function checkIfDescendant(
  storagePlugin: StoragePlugin,
  ancestorGuid: string,
  targetGuid: string
): Promise<boolean> {
  try {
    // Load the target page
    const targetPage = await storagePlugin.loadPage(targetGuid);
    
    // If target has no parent, it's not a descendant
    if (!targetPage.folderId) {
      return false;
    }

    // If target's parent is the ancestor, it's a direct child (descendant)
    if (targetPage.folderId === ancestorGuid) {
      return true;
    }

    // Recursively check if target's parent is a descendant of ancestor
    return await checkIfDescendant(storagePlugin, ancestorGuid, targetPage.folderId);
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    // If we can't find the page, assume it's not a descendant
    if (error.code === 'PAGE_NOT_FOUND') {
      return false;
    }
    throw error;
  }
}
