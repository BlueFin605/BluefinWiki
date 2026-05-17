/**
 * Drafts store — keeps unsaved page edits.
 *
 * Backed by localStorage so drafts survive reloads, save errors, and
 * authentication blips (e.g. expired token mid-edit). An in-memory Map
 * fronts localStorage for fast reads during a session.
 */

import { PageMetadata } from '../components/editor/PagePropertiesPanel';

export interface PageDraft {
  content: string;
  metadata: PageMetadata;
}

const STORAGE_PREFIX = 'bluefinwiki:draft:';
const memoryCache = new Map<string, PageDraft>();

function storageKey(guid: string): string {
  return `${STORAGE_PREFIX}${guid}`;
}

export function getDraft(guid: string): PageDraft | undefined {
  if (memoryCache.has(guid)) return memoryCache.get(guid);

  try {
    const raw = localStorage.getItem(storageKey(guid));
    if (!raw) return undefined;
    const draft = JSON.parse(raw) as PageDraft;
    memoryCache.set(guid, draft);
    return draft;
  } catch {
    return undefined;
  }
}

export function saveDraft(guid: string, draft: PageDraft): void {
  memoryCache.set(guid, draft);
  try {
    localStorage.setItem(storageKey(guid), JSON.stringify(draft));
  } catch {
    // Quota exhausted or storage disabled — fall back to memory-only.
    // The in-session experience still works; only reload recovery is lost.
  }
}

export function clearDraft(guid: string): void {
  memoryCache.delete(guid);
  try {
    localStorage.removeItem(storageKey(guid));
  } catch {
    // ignore
  }
}
