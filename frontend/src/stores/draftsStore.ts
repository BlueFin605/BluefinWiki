/**
 * In-memory drafts store
 *
 * Keeps unsaved page edits so they survive page-to-page navigation
 * within the same browser session. Drafts are lost on page refresh
 * or browser close (intentional – avoids stale conflict issues).
 */

import { PageMetadata } from '../components/editor/PagePropertiesPanel';

export interface PageDraft {
  content: string;
  metadata: PageMetadata;
}

const drafts = new Map<string, PageDraft>();

export function getDraft(guid: string): PageDraft | undefined {
  return drafts.get(guid);
}

export function saveDraft(guid: string, draft: PageDraft): void {
  drafts.set(guid, draft);
}

export function clearDraft(guid: string): void {
  drafts.delete(guid);
}
