import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { isTicketKey, canonicalKey, resolveKey } from './ticket-keys-service.js';

/**
 * Lambda: ticket-keys-resolve
 * GET /ticket-keys/{key}
 *
 * Resolves a Jira-style ticket key (case-insensitive) to its page.
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  const json = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = decodeURIComponent(event.pathParameters?.key ?? '');
  if (!isTicketKey(raw)) return json(400, { error: 'Invalid ticket key' });
  const key = canonicalKey(raw);

  try {
    const guid = await resolveKey(key);
    if (!guid) return json(404, { error: 'Ticket key not found' });

    let page;
    try {
      page = await getStoragePlugin().loadPage(guid);
    } catch (err) {
      if ((err as { code?: string }).code === 'PAGE_NOT_FOUND') {
        return json(404, { error: 'Ticket key not found' });
      }
      throw err;
    }
    if (page.status === 'deleted') return json(404, { error: 'Ticket key not found' });

    return json(200, { key, guid, title: page.title });
  } catch (err: unknown) {
    console.error('Error resolving ticket key:', err);
    return json(500, { error: 'Failed to resolve ticket key' });
  }
});
