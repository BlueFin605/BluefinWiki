import { Injectable } from '@angular/core';
import type { PageProperty } from './page.types';

/**
 * Minimal Phase 3 metadata shape, widened in Phase 4 with custom
 * properties (driven by page-type schemas). The fields here match what
 * the React `PageMetadata` interface uses for the save flow, so the
 * localStorage JSON shape is unchanged.
 */
export interface PageMetadata {
  title: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  pageType?: string;
  properties?: Record<string, PageProperty>;
  createdBy: string;
  modifiedBy: string;
  createdAt: string;
  modifiedAt: string;
  guid: string;
}

export interface PageDraft {
  content: string;
  metadata: PageMetadata;
}

const STORAGE_PREFIX = 'bluefinwiki:draft:';

function storageKey(guid: string): string {
  return `${STORAGE_PREFIX}${guid}`;
}

@Injectable({ providedIn: 'root' })
export class Drafts {
  private readonly memory = new Map<string, PageDraft>();

  get(guid: string): PageDraft | undefined {
    if (this.memory.has(guid)) return this.memory.get(guid);
    try {
      const raw = localStorage.getItem(storageKey(guid));
      if (!raw) return undefined;
      const draft = JSON.parse(raw) as PageDraft;
      this.memory.set(guid, draft);
      return draft;
    } catch {
      return undefined;
    }
  }

  set(guid: string, draft: PageDraft): void {
    this.memory.set(guid, draft);
    try {
      localStorage.setItem(storageKey(guid), JSON.stringify(draft));
    } catch {
      // Quota exhausted or storage disabled — memory cache still active.
    }
  }

  clear(guid: string): void {
    this.memory.delete(guid);
    try {
      localStorage.removeItem(storageKey(guid));
    } catch {
      // ignore
    }
  }

  hasDraft(guid: string): boolean {
    return this.get(guid) !== undefined;
  }
}
