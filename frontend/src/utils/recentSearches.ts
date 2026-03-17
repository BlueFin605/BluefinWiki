/**
 * Recent Searches Utility
 *
 * Manages recent search queries in localStorage.
 * - Stores last 10 searches
 * - Auto-cleanup of searches older than 30 days
 */

const STORAGE_KEY = 'bluefin_recent_searches';
const MAX_ITEMS = 10;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface RecentSearch {
  query: string;
  timestamp: number;
}

/**
 * Get all recent searches, cleaned of expired entries
 */
export function getRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const searches: RecentSearch[] = JSON.parse(raw);
    const now = Date.now();

    // Filter out expired searches
    const valid = searches.filter(s => (now - s.timestamp) < MAX_AGE_MS);

    // If we cleaned any, save back
    if (valid.length !== searches.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }

    return valid;
  } catch {
    return [];
  }
}

/**
 * Add a search query to recent searches
 */
export function addRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;

  try {
    const searches = getRecentSearches();

    // Remove existing entry for same query
    const filtered = searches.filter(s => s.query !== trimmed);

    // Add new entry at the front
    const updated = [{ query: trimmed, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Remove a specific search from recent searches
 */
export function removeRecentSearch(query: string): void {
  try {
    const searches = getRecentSearches();
    const filtered = searches.filter(s => s.query !== query);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}
