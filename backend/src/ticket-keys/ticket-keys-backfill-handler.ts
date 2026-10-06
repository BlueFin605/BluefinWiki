import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, withRole, AuthenticatedEvent } from '../middleware/auth.js';
import { backfillTicketKeys, BackfillError } from './ticket-keys-backfill.js';

/**
 * Lambda: ticket-keys-backfill
 * POST /pages/{guid}/ticket-keys/backfill  (Admin)
 *
 * Gives existing tickets under a prefixed Initiative their keys and repairs
 * missing key → GUID mappings. Safe to re-run.
 */
export const handler = withAuth(withRole(['Admin'], async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  const json = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const guid = event.pathParameters?.guid;
  if (!guid) return json(400, { error: 'Page GUID is required' });

  try {
    return json(200, await backfillTicketKeys(guid));
  } catch (err: unknown) {
    if (err instanceof BackfillError) return json(err.statusCode, { error: err.message });
    if ((err as { code?: string }).code === 'PAGE_NOT_FOUND') {
      return json(404, { error: 'Page not found' });
    }
    console.error('Error backfilling ticket keys:', err);
    return json(500, { error: 'Failed to backfill ticket keys' });
  }
}));
