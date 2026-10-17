import { APIGatewayProxyResult } from 'aws-lambda';
import { validate as validateUUID } from 'uuid';
import { withAuth, withRole, AuthenticatedEvent } from '../middleware/auth.js';
import { backfillBoardOrder } from './board-order-backfill.js';

/**
 * Lambda: pages-board-order-backfill
 * POST /pages/{guid}/board-order/backfill  (Admin)
 *
 * Gives every card beneath {guid} an explicit `boardOrder`, preserving the
 * order the board already shows. Run once per board to clear columns that
 * predate `boardOrder`; without it the first drag in such a column triggers a
 * full-column renumber that throttles and 500s. Safe to re-run — a second run
 * writes nothing.
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
  // Same check the storage plugins apply. Without it a malformed guid reaches
  // storage, throws INVALID_GUID and surfaces as a 500.
  if (!validateUUID(guid)) return json(400, { error: 'Invalid GUID format' });

  try {
    const result = await backfillBoardOrder(guid);
    console.log('boardOrder backfill:', { guid, ...result });
    return json(200, result);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'PAGE_NOT_FOUND') {
      return json(404, { error: 'Page not found' });
    }
    console.error('Error backfilling boardOrder:', err);
    return json(500, { error: 'Failed to backfill boardOrder' });
  }
}));
