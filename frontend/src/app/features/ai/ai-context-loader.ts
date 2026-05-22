/**
 * AiContextLoader — builds the per-turn RAG context block for the AI sidebar.
 *
 * Ports `frontend/src/services/AiContextLoader.ts`. Pulls:
 *   (a) the page the user is currently viewing,
 *   (b) top semantic-search hits via the existing /search endpoint, and
 *   (c) when the user is asking to create/edit something typed, the list of
 *       available page types.
 *
 * Output is plain text shoved into the *user* turn — never as a second system
 * message, which Chrome's Prompt API rejects. Kept terse because Gemini Nano's
 * context window is ~4-6k tokens.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PageContent, PageTypeDefinition } from '../pages/page.types';
import type { WikiSearchResult } from '../search/search.types';
import { Search } from '../search/search';

const MAX_PAGE_CONTENT_CHARS = 1200;
const MAX_SNIPPET_CHARS = 300;
const SEARCH_LIMIT = 4;
const MAX_PAGE_TYPES = 10;

// UUID pattern — if the message already contains one the user has supplied the GUID directly
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Keywords that suggest the user wants to create or update a typed page
const CREATE_KEYWORDS = /\b(create|add|new|make|build|set type|page type|typed)\b/i;
// For media lookups, wiki semantic search often distracts the model from calling fetch_imdb_show first.
const TV_LOOKUP_KEYWORDS = /\b(tv show|series|season|episodes?|imdb|synopsis|rating|cast|about\s+the\s+show)\b/i;

export interface RagContextOptions {
  currentPageGuid?: string | null;
  userMessage: string;
}

interface PageTypesResponse {
  pageTypes: PageTypeDefinition[];
}

@Injectable({ providedIn: 'root' })
export class AiContextLoader {
  private readonly http = inject(HttpClient);
  private readonly searchService = inject(Search);

  async buildRagContext(opts: RagContextOptions): Promise<string> {
    const messageHasGuid = UUID_PATTERN.test(opts.userMessage);
    const needsPageTypes =
      !messageHasGuid && CREATE_KEYWORDS.test(opts.userMessage);
    const isTvLookupIntent = TV_LOOKUP_KEYWORDS.test(opts.userMessage);
    const includeProperties = needsPageTypes;

    const [current, hits, pageTypes] = await Promise.all([
      opts.currentPageGuid
        ? this.loadCurrentPage(opts.currentPageGuid).catch(() => null)
        : Promise.resolve(null),
      isTvLookupIntent
        ? Promise.resolve([] as WikiSearchResult[])
        : this.runSearch(opts.userMessage).catch(
            () => [] as WikiSearchResult[],
          ),
      needsPageTypes
        ? this.loadPageTypes().catch(() => [] as PageTypeDefinition[])
        : Promise.resolve([] as PageTypeDefinition[]),
    ]);

    const lines: string[] = [];

    if (current) {
      lines.push('Current page (the one the user is viewing):');
      lines.push(`- GUID: ${current.guid}`);
      lines.push(`- Title: ${current.title}`);
      if (current.tags.length) {
        lines.push(`- Tags: ${current.tags.join(', ')}`);
      }
      if (current.content) {
        lines.push(
          `- Content (truncated):\n${truncate(current.content, MAX_PAGE_CONTENT_CHARS)}`,
        );
      }
      lines.push('');
    }

    const otherHits = hits
      .filter((h) => h.pageId !== opts.currentPageGuid)
      .slice(0, SEARCH_LIMIT);
    if (otherHits.length > 0) {
      lines.push('Related pages (semantic search over the wiki):');
      for (const hit of otherHits) {
        lines.push(`- GUID: ${hit.pageId} | Title: ${hit.title}`);
        if (hit.snippet) {
          lines.push(`  Snippet: ${truncate(hit.snippet, MAX_SNIPPET_CHARS)}`);
        }
      }
    }

    if (isTvLookupIntent) {
      lines.push('');
      lines.push(
        'Note: This looks like a TV-show lookup. Prefer using fetch_imdb_show before relying on wiki search context.',
      );
    }

    if (pageTypes.length > 0) {
      lines.push('');
      lines.push(
        'Available page types (use pageType GUID when creating/updating typed pages):',
      );
      for (const pt of pageTypes.slice(0, MAX_PAGE_TYPES)) {
        let line = `- GUID: ${pt.guid} | Name: ${pt.name}${pt.icon ? ` ${pt.icon}` : ''}`;
        if (includeProperties && pt.properties.length > 0) {
          const propList = pt.properties
            .map((p) => `${p.name}:${p.type}${p.required ? '*' : ''}`)
            .join(', ');
          line += ` | props: ${propList}`;
        }
        lines.push(line);
      }
    }

    return lines.join('\n').trim();
  }

  private async loadPageTypes(): Promise<PageTypeDefinition[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<PageTypesResponse>('/api/page-types'),
      );
      return response.pageTypes ?? [];
    } catch {
      return [];
    }
  }

  private async loadCurrentPage(guid: string): Promise<PageContent | null> {
    try {
      return await firstValueFrom(
        this.http.get<PageContent>(`/api/pages/${guid}`),
      );
    } catch {
      return null;
    }
  }

  private async runSearch(text: string): Promise<WikiSearchResult[]> {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const result = await this.searchService.search({
      text: trimmed,
      scope: 'all',
      limit: SEARCH_LIMIT,
      offset: 0,
    });
    return [...result.results];
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
