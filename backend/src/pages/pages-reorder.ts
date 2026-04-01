import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';

const ReorderRequestSchema = z.object({
  parentGuid: z.string().uuid().nullable(),
  orderedGuids: z.array(z.string().uuid()).min(1),
});

/**
 * Lambda: pages-reorder
 * PUT /pages/reorder
 *
 * Reorders sibling pages under a shared parent. Assigns sequential
 * sortOrder values (0, 1000, 2000, ...) to the pages in the order
 * specified by orderedGuids.
 *
 * Request Body:
 * {
 *   "parentGuid": "parent-guid-or-null",
 *   "orderedGuids": ["guid1", "guid2", "guid3"]
 * }
 *
 * Response:
 * { "updated": 3 }
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON' }),
      };
    }

    const parseResult = ReorderRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Validation failed',
          details: parseResult.error.issues,
        }),
      };
    }

    const { parentGuid, orderedGuids } = parseResult.data;
    const storage = getStoragePlugin();

    console.log('[reorder] Request:', { parentGuid, orderedGuids });

    // Validate parent exists (if not root)
    if (parentGuid) {
      try {
        await storage.loadPage(parentGuid);
      } catch {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Parent page not found' }),
        };
      }
    }

    // Load current children to validate the GUIDs are actual siblings
    const currentChildren = await storage.listChildren(parentGuid);
    const childGuidSet = new Set(currentChildren.map(c => c.guid));

    console.log('[reorder] Children of parent:', {
      parentGuid,
      childGuids: Array.from(childGuidSet),
      requestedGuids: orderedGuids,
    });

    const invalidGuids = orderedGuids.filter(g => !childGuidSet.has(g));
    if (invalidGuids.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Some GUIDs are not children of the specified parent',
          invalidGuids,
        }),
      };
    }

    // Assign sequential sortOrder values.
    // Use the request's parentGuid for saving — it's already validated
    // that all GUIDs are children of this parent.
    let updated = 0;
    for (let i = 0; i < orderedGuids.length; i++) {
      const guid = orderedGuids[i];
      const newSortOrder = i * 1000;

      try {
        const page = await storage.loadPage(guid);

        // Skip if sortOrder is already correct
        if (page.sortOrder === newSortOrder) continue;

        console.log(`[reorder] Updating ${guid}: sortOrder ${page.sortOrder} → ${newSortOrder}`);
        page.sortOrder = newSortOrder;
        await storage.savePage(guid, parentGuid, page);
        updated++;
      } catch (err) {
        console.error(`[reorder] Failed to update sortOrder for ${guid}:`, err);
      }
    }

    console.log('[reorder] Done:', { updated, total: orderedGuids.length });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updated }),
    };
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    console.error('Reorder failed:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
});
