/**
 * Keys that move the highlighted row in the search results listbox.
 */
export type SelectionKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

/**
 * Pure maths for search-result keyboard navigation: given the currently
 * selected index (`-1` when nothing is selected), a navigation key, and the
 * number of results, returns the next selected index.
 *
 * `ArrowDown`/`ArrowUp` **clamp** at the list bounds rather than wrapping
 * (matches React). `Home`/`End` jump to the first/last result. An empty
 * result list (`length <= 0`) always yields `-1`.
 */
export function moveSelection(current: number, key: SelectionKey, length: number): number {
  if (length <= 0) return -1;

  switch (key) {
    case 'ArrowDown':
      return Math.min(current + 1, length - 1);
    case 'ArrowUp':
      return Math.max(current - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
  }
}
