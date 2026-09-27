/**
 * Smooth-scroll to the rendered heading whose `id` matches `slug`, then reflect
 * that slug in the URL fragment **without** adding a history entry.
 *
 * Shared by the markdown renderer's in-page `#anchor` click handler and the
 * table-of-contents rail — both perform the identical interaction ("click →
 * smooth scroll + hash"). A bare `window.location.hash = slug` assignment (which
 * the TOC used to do) is wrong on two counts: it triggers the browser's own
 * *instant* fragment jump, which lands on top of the `scrollIntoView` smooth
 * animation, and it pushes a history entry per click, so Back walks the user
 * through their own scrolling. `history.replaceState` avoids both.
 */
export function scrollToSlug(slug: string): void {
  if (!slug) return;

  const el = typeof document !== 'undefined' ? document.getElementById(slug) : null;
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const hash = `#${slug}`;
  try {
    history.replaceState(history.state, '', hash);
  } catch {
    // Some embedded contexts disallow History API writes — fall back to the
    // (still non-throwing) hash assignment; the scroll has already run.
    try {
      window.location.hash = slug;
    } catch {
      /* nothing more we can do — the scroll is the important part */
    }
  }
}
