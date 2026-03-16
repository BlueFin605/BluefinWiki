import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { PageContent } from '../types/index.js';
import { extractWikiLinks, updatePageLinks } from './link-extraction.js';

// Request validation schema
const CreatePageRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  content: z.string().default(''),
  parentGuid: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['published', 'archived']).default('published'),
});

/**
 * Lambda: pages-create
 * POST /pages
 * 
 * Creates a new page with the provided content and metadata.
 * 
 * Request Body:
 * {
 *   "title": "Page Title",
 *   "content": "# Markdown content",
 *   "parentGuid": "parent-guid-or-null",  // optional
 *   "tags": ["tag1", "tag2"],             // optional
 *   "status": "published"                  // optional, default: published
 * }
 * 
 * Response:
 * {
 *   "guid": "page-guid",
 *   "title": "Page Title",
 *   "createdAt": "2026-02-06T12:00:00Z"
 * }
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validationResult = CreatePageRequestSchema.safeParse(body);

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

    const { title, content, parentGuid = null, tags, status } = validationResult.data;

    // Get authenticated user context
    const user = getUserContext(event);

    // Generate new page GUID
    const guid = uuidv4();
    const now = new Date().toISOString();

    // Build PageContent object
    const pageContent: PageContent = {
      guid,
      title,
      content,
      folderId: parentGuid || '',
      tags,
      status,
      createdBy: user.userId,
      modifiedBy: user.userId,
      createdAt: now,
      modifiedAt: now,
    };

    // Get storage plugin instance
    const storagePlugin = getStoragePlugin();

    // Save page to storage
    await storagePlugin.savePage(guid, parentGuid, pageContent);

    // Extract and save page links
    if (content) {
      const wikiLinks = extractWikiLinks(content);
      await updatePageLinks(guid, wikiLinks);
      console.log('Page links created:', {
        guid,
        linkCount: wikiLinks.length,
      });
    }

    // Log activity
    console.log('Page created:', {
      guid,
      title,
      parentGuid,
      createdBy: user.userId,
      timestamp: now,
    });

    // Return success response
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guid,
        title,
        parentGuid,
        createdAt: now,
      }),
    };
  } catch (err: unknown) {
    console.error('Error creating page:', err);
    const error = err as { code?: string; name?: string; message?: string; statusCode?: number };

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
      body: JSON.stringify({ error: 'Failed to create page' }),
    };
  }
});
