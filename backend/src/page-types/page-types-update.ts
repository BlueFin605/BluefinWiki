import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent, getUserContext, isAdmin } from '../middleware/auth.js';
import { getPageType, updatePageType } from './page-types-service.js';

const PageTypePropertySchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Property names must be kebab-case'),
  type: z.enum(['string', 'number', 'date', 'tags']),
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
});

const UpdatePageTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().min(1).max(50).optional(),
  properties: z.array(PageTypePropertySchema).optional(),
  allowedChildTypes: z.array(z.string().uuid()).optional(),
  allowWikiPageChildren: z.boolean().optional(),
});

/**
 * Lambda: page-types-update
 * PUT /page-types/:guid
 *
 * Updates a page type definition. Only the creator or an admin can update.
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
        body: JSON.stringify({ error: 'Page type GUID is required' }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validationResult = UpdatePageTypeSchema.safeParse(body);

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

    // Check authorization: creator or admin
    const user = getUserContext(event);
    const existing = await getPageType(guid);

    if (!existing) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Page type not found' }),
      };
    }

    if (existing.createdBy !== user.userId && !isAdmin(event)) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Only the creator or an admin can update this page type' }),
      };
    }

    const updated = await updatePageType(guid, validationResult.data);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    };
  } catch (err: unknown) {
    console.error('Error updating page type:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to update page type' }),
    };
  }
});
