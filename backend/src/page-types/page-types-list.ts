import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { listPageTypes } from './page-types-service.js';

/**
 * Lambda: page-types-list
 * GET /page-types
 *
 * Returns all page type definitions, sorted alphabetically by name.
 */
export const handler = withAuth(async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const pageTypes = await listPageTypes();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageTypes }),
    };
  } catch (err: unknown) {
    console.error('Error listing page types:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to list page types' }),
    };
  }
});
