/**
 * Recent-searches persistence (Phase 6 step 6.4). Ports the React app's
 * `utils/recentSearches` behaviour: a small, deduped, most-recent-first list
 * of search terms, capped and stored client-side.
 *
 * Two layers, deliberately kept separate:
 *  - Pure list ops (`addRecent`/`removeRecent`) — no I/O, trivially testable.
 *  - A small `localStorage` accessor pair, wrapped in try/catch (private
 *    browsing / disabled storage must never throw). No shared "safe storage"
 *    utility exists elsewhere in this codebase (`layout.ts`/`drafts.ts` each
 *    inline their own try/catch the same way), so this stays local to the
 *    feature rather than inventing shared infrastructure.
 */

export const RECENT_SEARCHES_KEY = 'bluefinwiki:recent-searches';

/** Matches the brief's "~8–10" cap. */
export const MAX_RECENT_SEARCHES = 10;

/**
 * Returns a new list with `term` moved to the front: trimmed, deduped
 * (an existing exact match is dropped rather than duplicated), and capped at
 * {@link MAX_RECENT_SEARCHES}. A blank/whitespace-only `term` is a no-op.
 * Never mutates `list`.
 */
export function addRecent(list: readonly string[], term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return [...list];
  const deduped = list.filter((existing) => existing !== trimmed);
  return [trimmed, ...deduped].slice(0, MAX_RECENT_SEARCHES);
}

/**
 * Returns a new list with every exact match of `term` dropped. A no-op when
 * `term` isn't present. Never mutates `list`.
 */
export function removeRecent(list: readonly string[], term: string): string[] {
  return list.filter((existing) => existing !== term);
}

/**
 * Reads the persisted recent-searches list. Returns `[]` for missing,
 * malformed, or non-array/non-string-entry storage content, and swallows any
 * `localStorage` access failure (private mode / disabled storage) — this
 * never throws.
 */
export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

/**
 * Persists `list` as-is (callers pass an already-deduped/capped list from
 * {@link addRecent}/{@link removeRecent}). Swallows any `localStorage` write
 * failure (quota exceeded / disabled storage) — this never throws.
 */
export function writeRecentSearches(list: readonly string[]): void {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable — the caller's in-memory signal still updates.
  }
}
