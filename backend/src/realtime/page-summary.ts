/**
 * The one PageContent → PageSummary mapping. Shared by the storage plugin's
 * listChildren (board / tree endpoints) and the realtime page-upsert message,
 * so a card pushed over the socket is shaped exactly like one fetched over HTTP.
 *
 * `hasChildren` is left to the caller — it needs an extra storage lookup the
 * mapper can't make.
 */
import type { PageContent, PageSummary } from '../types/index.js';

export function toPageSummary(page: PageContent, parentGuid: string | null): Omit<PageSummary, 'hasChildren'> {
  return {
    guid: page.guid,
    title: page.title,
    parentGuid: parentGuid || null,
    status: page.status === 'deleted' ? 'archived' : page.status,
    ...(page.sortOrder !== undefined ? { sortOrder: page.sortOrder } : {}),
    ...(page.boardOrder !== undefined ? { boardOrder: page.boardOrder } : {}),
    ...(page.ticketKey ? { ticketKey: page.ticketKey } : {}),
    createdBy: page.createdBy,
    modifiedAt: page.modifiedAt,
    modifiedBy: page.modifiedBy,
    ...(page.pageType ? { pageType: page.pageType } : {}),
    ...(page.properties && Object.keys(page.properties).length > 0 ? { properties: page.properties } : {}),
    ...(page.tags?.length ? { tags: page.tags } : {}),
  };
}
