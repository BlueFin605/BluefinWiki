import { parseWikiLinks, getDisplayText } from './wiki-link-parser';

/**
 * Pure helper backing step 2.7's Create-Page-from-Link flow: rewrite every
 * `[[fromTarget]]` / `[[fromTarget|text]]` occurrence in `markdown` to
 * `[[toGuid|text]]`.
 *
 * Built on {@link parseWikiLinks} so the matching, trimming, and (page-title
 * vs. page-guid) target extraction stay aligned with `wiki-link-parser.ts`'s
 * own regex and conventions — this never hand-rolls a second wiki-link
 * pattern. Matching against `fromTarget` is additionally case-insensitive
 * (both sides trimmed) — the parser itself only trims, it does not compare
 * case-insensitively, so that rule lives here.
 *
 * Display text is preserved per occurrence: a link that already carried
 * `|text` keeps that exact text; a bare `[[fromTarget]]` uses *that
 * occurrence's own* (trimmed) target text as the display text — i.e.
 * `getDisplayText` applied to each match, not a value threaded in from the
 * caller. A `[[foo]]` and a `[[FOO]]` both matching `fromTarget: 'Foo'`
 * therefore rewrite to `[[toGuid|foo]]` and `[[toGuid|FOO]]` respectively.
 *
 * Only `[[…]]` tokens are touched; everything else in `markdown` (including
 * non-matching wiki links) passes through unchanged. Returns `markdown`
 * unchanged **by reference** when nothing matches, mirroring
 * `rewriteFirstH1`'s no-op convention so callers can use `===` as a cheap
 * "nothing to do" guard.
 */
export function rewriteWikiLink(markdown: string, fromTarget: string, toGuid: string): string {
  const needle = fromTarget.trim().toLowerCase();
  const links = parseWikiLinks(markdown).filter(
    (link) => link.target.trim().toLowerCase() === needle,
  );
  if (links.length === 0) return markdown;

  let result = '';
  let lastEnd = 0;
  for (const link of links) {
    const displayText = getDisplayText(link);
    result += markdown.slice(lastEnd, link.startIndex) + `[[${toGuid}|${displayText}]]`;
    lastEnd = link.endIndex;
  }
  return result + markdown.slice(lastEnd);
}
