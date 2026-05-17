/**
 * AiContextLoader — builds the per-turn RAG context block for the AI sidebar.
 *
 * Pulls: (a) the page the user is currently viewing, (b) top semantic-search
 * hits keyed off the user's message via the existing /search endpoint
 * (Bedrock embeddings + S3 Vectors, server-side).
 *
 * Output is plain text shoved into the *user* turn — never as a second system
 * message, which Chrome's Prompt API rejects. Kept terse because Gemini Nano's
 * context window is ~4-6k tokens.
 */

import { apiClient } from '../config/api';
import { ClientSearchService } from './ClientSearchService';
import type { PageContent, PageTypeDefinition } from '../types/page';
import type { WikiSearchResult } from '../types/search';

const MAX_PAGE_CONTENT_CHARS = 1200;
const MAX_SNIPPET_CHARS = 300;
const SEARCH_LIMIT = 4;
const MAX_PAGE_TYPES = 10;

// UUID pattern — if the message already contains one the user has supplied the GUID directly
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Keywords that suggest the user wants to create or update a typed page
const CREATE_KEYWORDS = /\b(create|add|new|make|build|set type|page type|typed)\b/i;
// For media lookups, wiki semantic search often distracts the model from calling fetch_imdb_show first.
const TV_LOOKUP_KEYWORDS = /\b(tv show|series|season|episodes?|imdb|synopsis|rating|cast|about\s+the\s+show)\b/i;

const searchService = new ClientSearchService();

export interface RagContextOptions {
  currentPageGuid?: string | null;
  userMessage: string;
}

export async function buildRagContext(opts: RagContextOptions): Promise<string> {
  // If the message already contains a UUID the user has the GUID — no need to load types.
  // Only load types when the message looks like a create/update intent.
  const messageHasGuid = UUID_PATTERN.test(opts.userMessage);
  const needsPageTypes = !messageHasGuid && CREATE_KEYWORDS.test(opts.userMessage);
  const isTvLookupIntent = TV_LOOKUP_KEYWORDS.test(opts.userMessage);
  const includeProperties = needsPageTypes;

  const [current, hits, pageTypes] = await Promise.all([
    opts.currentPageGuid ? loadCurrentPage(opts.currentPageGuid).catch(() => null) : Promise.resolve(null),
    isTvLookupIntent
      ? Promise.resolve([] as WikiSearchResult[])
      : runSearch(opts.userMessage).catch(() => [] as WikiSearchResult[]),
    needsPageTypes ? loadPageTypes().catch(() => [] as PageTypeDefinition[]) : Promise.resolve([] as PageTypeDefinition[]),
  ]);

  const lines: string[] = [];

  if (current) {
    lines.push('Current page (the one the user is viewing):');
    lines.push(`- GUID: ${current.guid}`);
    lines.push(`- Title: ${current.title}`);
    if (current.tags?.length) lines.push(`- Tags: ${current.tags.join(', ')}`);
    if (current.content) {
      lines.push(`- Content (truncated):\n${truncate(current.content, MAX_PAGE_CONTENT_CHARS)}`);
    }
    lines.push('');
  }

  const otherHits = hits.filter((h) => h.pageId !== opts.currentPageGuid).slice(0, SEARCH_LIMIT);
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
    lines.push('Note: This looks like a TV-show lookup. Prefer using fetch_imdb_show before relying on wiki search context.');
  }

  if (pageTypes.length > 0) {
    lines.push('');
    lines.push('Available page types (use pageType GUID when creating/updating typed pages):');
    for (const pt of pageTypes.slice(0, MAX_PAGE_TYPES)) {
      let line = `- GUID: ${pt.guid} | Name: ${pt.name}${pt.icon ? ` ${pt.icon}` : ''}`;
      if (includeProperties && pt.properties.length > 0) {
        const propList = pt.properties.map(p =>
          `${p.name}:${p.type}${p.required ? '*' : ''}`
        ).join(', ');
        line += ` | props: ${propList}`;
      }
      lines.push(line);
    }
  }

  return lines.join('\n').trim();
}

async function loadPageTypes(): Promise<PageTypeDefinition[]> {
  try {
    const response = await apiClient.get('/page-types');
    return response.data.pageTypes || [];
  } catch {
    return [];
  }
}

async function loadCurrentPage(guid: string): Promise<PageContent | null> {
  try {
    const response = await apiClient.get<PageContent>(`/pages/${guid}`);
    return response.data;
  } catch {
    return null;
  }
}

async function runSearch(text: string): Promise<WikiSearchResult[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const result = await searchService.search({
    text: trimmed,
    scope: 'all',
    limit: SEARCH_LIMIT,
    offset: 0,
  });
  return result.results;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
