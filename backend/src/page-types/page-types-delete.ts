import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext, isAdmin } from '../middleware/auth.js';
import { getPageType, deletePageType } from './page-types-service.js';

/**
 * Lambda: page-types-delete
 * DELETE /page-types/:guid
 *
 * Deletes a page type definition. Only the creator or an admin can delete.
 * Does not affect pages already using this type — they keep their pageType
 * field but validation stops enforcing the deleted type's schema.
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
        body: JSON.stringify({ error: 'Only the creator or an admin can delete this page type' }),
      };
    }

    await deletePageType(guid);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted: true, guid }),
    };
  } catch (err: unknown) {
    console.error('Error deleting page type:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to delete page type' }),
    };
  }
});
