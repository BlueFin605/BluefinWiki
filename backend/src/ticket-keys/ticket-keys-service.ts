/**
 * Ticket-key service: allocates keys for new ticket pages (nearest Initiative's
 * keyPrefix + atomic counter), records key -> GUID mappings, and resolves keys.
 * Key assignment must never make page creation fail.
 */

import { allocateNumber, putMapping, getMapping } from './ticket-keys-store.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { getPageType } from '../page-types/page-types-service.js';

const INITIATIVE = 'Initiative';

export const TICKET_KEY_REGEX = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

export const isTicketKey = (ref: string): boolean => TICKET_KEY_REGEX.test(ref.trim());

export const canonicalKey = (ref: string): string => ref.trim().toUpperCase();

export const isTicketType = (t: { name: string; properties: { name: string }[] }): boolean =>
  t.name !== INITIATIVE && t.properties.some((p) => p.name === 'state');

/** keyPrefix of the nearest Initiative at or above parentGuid, if any. */
export async function prefixForParent(parentGuid: string | null): Promise<string | undefined> {
  const storage = getStoragePlugin();
  let guid = parentGuid;
  for (let hops = 0; guid && hops < 50; hops++) {
    const page = await storage.loadPage(guid);
    const type = page.pageType ? await getPageType(page.pageType) : null;
    if (type?.name === INITIATIVE) return page.boardConfig?.keyPrefix || undefined;
    guid = page.folderId || null;
  }
  return undefined;
}

/** Allocate a key for a new page, or undefined if it is not a keyed ticket. Never throws. */
export async function keyForNewPage(
  parentGuid: string | null,
  pageType: string | undefined,
): Promise<string | undefined> {
  try {
    if (!pageType) return undefined;
    const type = await getPageType(pageType);
    if (!type || !isTicketType(type)) return undefined;
    const prefix = await prefixForParent(parentGuid);
    if (!prefix) return undefined;
    return `${prefix}-${await allocateNumber(prefix)}`;
  } catch (err) {
    console.warn('[ticket-keys] key allocation failed; creating page without a key:', err);
    return undefined;
  }
}

/** Record key -> guid. Never throws. */
export async function recordKey(key: string, guid: string): Promise<void> {
  try {
    await putMapping(key, guid);
  } catch (err) {
    console.warn(`[ticket-keys] failed to record ${key} -> ${guid}; run the backfill to repair:`, err);
  }
}

export async function resolveKey(ref: string): Promise<string | null> {
  return isTicketKey(ref) ? getMapping(canonicalKey(ref)) : null;
}
