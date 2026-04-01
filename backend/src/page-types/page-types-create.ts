import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { createPageType } from './page-types-service.js';
import { PageTypeDefinition } from '../types/index.js';

const PageTypePropertySchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Property names must be kebab-case'),
  type: z.enum(['string', 'number', 'date', 'tags']),
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
});

const CreatePageTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  icon: z.string().min(1, 'Icon is required').max(50),
  properties: z.array(PageTypePropertySchema).default([]),
  allowedChildTypes: z.array(z.string().uuid()).default([]),
  allowWikiPageChildren: z.boolean().default(true),
  allowedParentTypes: z.array(z.string().uuid()).default([]),
  allowAnyParent: z.boolean().default(true),
});

/**
 * Lambda: page-types-create
 * POST /page-types
 *
 * Creates a new page type definition. Any authenticated user can create types.
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

    const body = JSON.parse(event.body);
    const validationResult = CreatePageTypeSchema.safeParse(body);

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

    const user = getUserContext(event);
    const now = new Date().toISOString();

    const pageType: PageTypeDefinition = {
      guid: uuidv4(),
      ...validationResult.data,
      createdBy: user.userId,
      createdAt: now,
      updatedAt: now,
    };

    await createPageType(pageType);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageType),
    };
  } catch (err: unknown) {
    console.error('Error creating page type:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to create page type' }),
    };
  }
});
