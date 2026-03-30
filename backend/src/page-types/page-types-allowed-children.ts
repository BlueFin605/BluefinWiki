import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { getPageType, getAllowedChildTypes } from './page-types-service.js';

/**
 * Lambda: page-types-allowed-children
 * GET /page-types/:guid/allowed-children
 *
 * Returns the type definitions allowed as children for the given page type.
 * Convenience endpoint for the UI when creating child pages.
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

    const pageType = await getPageType(guid);

    if (!pageType) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Page type not found' }),
      };
    }

    const allowedChildren = await getAllowedChildTypes(guid);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowedChildTypes: allowedChildren,
        allowWikiPageChildren: pageType.allowWikiPageChildren,
      }),
    };
  } catch (err: unknown) {
    console.error('Error getting allowed child types:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get allowed child types' }),
    };
  }
});
