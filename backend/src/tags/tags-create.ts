import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { createTag, PAGE_TAGS_SCOPE } from './tags-service.js';

const CreateTagSchema = z.object({
  tag: z.string().min(1, 'Tag name is required').max(100, 'Tag must be 100 characters or less'),
  scope: z.string().min(1).max(100).optional(),
});

/**
 * Lambda: tags-create
 * POST /tags
 *
 * Creates a new tag in the shared vocabulary. Admin only.
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserContext(event);

    if (user.role !== 'Admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Admin access required' }),
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
    const validationResult = CreateTagSchema.safeParse(body);

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

    const scope = validationResult.data.scope || PAGE_TAGS_SCOPE;
    const record = await createTag(scope, validationResult.data.tag, user.userId);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    };
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Tag already exists' }),
      };
    }

    console.error('Error creating tag:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to create tag' }),
    };
  }
});
