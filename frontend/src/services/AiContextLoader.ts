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
import type { PageContent } from '../types/page';
import type { WikiSearchResult } from '../types/search';

const MAX_PAGE_CONTENT_CHARS = 1200;
const MAX_SNIPPET_CHARS = 300;
const SEARCH_LIMIT = 4;

const searchService = new ClientSearchService();

export interface RagContextOptions {
  currentPageGuid?: string | null;
  userMessage: string;
}

export async function buildRagContext(opts: RagContextOptions): Promise<string> {
  const [current, hits] = await Promise.all([
    opts.currentPageGuid ? loadCurrentPage(opts.currentPageGuid).catch(() => null) : Promise.resolve(null),
    runSearch(opts.userMessage).catch(() => [] as WikiSearchResult[]),
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

  return lines.join('\n').trim();
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
