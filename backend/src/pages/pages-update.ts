import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { PageContent } from '../types/index.js';
import { extractWikiLinks, updatePageLinks } from './link-extraction.js';

// Request validation schema
const UpdatePageRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less').optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

/**
 * Lambda: pages-update
 * PUT /pages/{guid}
 * 
 * Updates an existing page with new content and/or metadata.
 * Creates a new version in storage (S3 versioning).
 * 
 * Path Parameters:
 * - guid: Page GUID
 * 
 * Request Body (all fields optional):
 * {
 *   "title": "Updated Title",
 *   "content": "# Updated markdown content",
 *   "tags": ["tag1", "tag2"],
 *   "status": "published"
 * }
 * 
 * Response:
 * {
 *   "guid": "page-guid",
 *   "title": "Updated Title",
 *   "modifiedAt": "2026-02-06T12:00:00Z",
 *   "modifiedBy": "user-id"
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
    const validationResult = UpdatePageRequestSchema.safeParse(body);

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

    const updates = validationResult.data;

    // Get authenticated user context
    const user = getUserContext(event);

    // Get storage plugin instance
    const storagePlugin = getStoragePlugin();

    // Load existing page
    let existingPage: PageContent;
    try {
      existingPage = await storagePlugin.loadPage(guid);
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

    // Build updated page content (merge existing with updates)
    const now = new Date().toISOString();
    const updatedPage: PageContent = {
      ...existingPage,
      ...updates,
      modifiedBy: user.userId,
      modifiedAt: now,
      // Preserve fields that should not be updated via this endpoint
      guid: existingPage.guid,
      folderId: existingPage.folderId, // Use movePage endpoint to change parent
      createdBy: existingPage.createdBy,
      createdAt: existingPage.createdAt,
    };

    // Determine parentGuid from folderId
    const parentGuid = updatedPage.folderId || null;

    // Save updated page (creates new version)
    await storagePlugin.savePage(guid, parentGuid, updatedPage);

    // Extract and update page links if content was modified
    if (updates.content !== undefined) {
      const wikiLinks = extractWikiLinks(updatedPage.content);
      await updatePageLinks(guid, wikiLinks);
      console.log('Page links updated:', {
        guid,
        linkCount: wikiLinks.length,
      });
    }

    // Log activity
    console.log('Page updated:', {
      guid,
      title: updatedPage.title,
      modifiedBy: user.userId,
      timestamp: now,
      changes: Object.keys(updates),
    });

    // Return success response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guid,
        title: updatedPage.title,
        modifiedAt: now,
        modifiedBy: user.userId,
      }),
    };
  } catch (err: unknown) {
    console.error('Error updating page:', err);
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
      body: JSON.stringify({ error: 'Failed to update page' }),
    };
  }
});
