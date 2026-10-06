/**
 * Ticket-key backfill: gives every unkeyed ticket under a prefixed Initiative a
 * key (oldest first) and repairs missing key -> GUID mappings for keyed ones.
 * Idempotent — a second run assigns and repairs nothing.
 */

import { allocateNumber, putMapping } from './ticket-keys-store.js';
import { isTicketType } from './ticket-keys-service.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { listPageTypes } from '../page-types/page-types-service.js';
import type { PageContent, PageTypeDefinition } from '../types/index.js';

export interface BackfillResult {
  assigned: number;
  repaired: number;
}

export class BackfillError extends Error {
  constructor(message: string, readonly statusCode: 400) {
    super(message);
    this.name = 'BackfillError';
  }
}

export async function backfillTicketKeys(initiativeGuid: string): Promise<BackfillResult> {
  const storage = getStoragePlugin();
  const initiative = await storage.loadPage(initiativeGuid);

  const typesByGuid = new Map<string, PageTypeDefinition>(
    (await listPageTypes()).map((t) => [t.guid, t]),
  );
  const typeOf = (guid?: string) => (guid ? typesByGuid.get(guid) : undefined);

  if (typeOf(initiative.pageType)?.name !== 'Initiative') {
    throw new BackfillError('Not an Initiative', 400);
  }
  const prefix = initiative.boardConfig?.keyPrefix;
  if (!prefix) throw new BackfillError('Initiative has no keyPrefix', 400);

  // Depth-first walk, descending only through ticket-type pages.
  const tickets: PageContent[] = [];
  const walk = async (parentGuid: string): Promise<void> => {
    for (const child of await storage.listChildren(parentGuid)) {
      const type = typeOf(child.pageType);
      if (!type || !isTicketType(type)) continue;
      tickets.push(await storage.loadPage(child.guid));
      await walk(child.guid);
    }
  };
  await walk(initiativeGuid);

  let repaired = 0;
  for (const page of tickets.filter((p) => p.ticketKey)) {
    try {
      if ((await putMapping(page.ticketKey!, page.guid)) === 'created') repaired++;
    } catch (err) {
      console.error(`[ticket-keys] backfill: cannot map ${page.ticketKey} -> ${page.guid}:`, err);
    }
  }

  const unkeyed = tickets
    .filter((p) => !p.ticketKey)
    .sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.guid < b.guid ? -1 : a.guid > b.guid ? 1 : 0,
    );

  let assigned = 0;
  for (const page of unkeyed) {
    const key = `${prefix}-${await allocateNumber(prefix)}`;
    await storage.savePage(page.guid, page.folderId || null, { ...page, ticketKey: key });
    await putMapping(key, page.guid);
    assigned++;
  }

  return { assigned, repaired };
}
