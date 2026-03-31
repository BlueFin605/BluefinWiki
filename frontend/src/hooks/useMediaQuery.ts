import { useState, useEffect } from 'react';

/** Breakpoint media queries */
export const MOBILE = '(max-width: 767px)';
export const TABLET = '(min-width: 768px) and (max-width: 1023px)';
export const DESKTOP = '(min-width: 1024px)';

/**
 * React hook that subscribes to a CSS media query.
 * Returns true when the query matches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
