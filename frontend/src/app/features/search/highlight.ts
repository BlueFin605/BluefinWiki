/**
 * One chunk of `highlight`'s output: either plain text, or a substring that
 * matched the search query (`match: true`) and should be wrapped in
 * `<mark>` by the template.
 */
export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into segments around case-insensitive occurrences of
 * `query`, for the template to render with `@for` + `<mark>` instead of
 * `innerHTML` — see the step-6.5 brief. Deliberately returns **segments**,
 * not HTML: `query` is escaped for use in a `RegExp` (so regex-special
 * characters like `(`, `.`, `$` are matched literally), but `text` itself is
 * returned verbatim, unescaped. It's the caller's Angular interpolation
 * binding (`{{ }}`, never `innerHTML`) that makes rendering the result safe
 * against injection — this helper only decides *where* to split, not how to
 * render.
 *
 * A blank (empty or whitespace-only) query, or no match at all, yields a
 * single unmarked segment containing the whole text.
 */
export function highlight(text: string, query: string): HighlightSegment[] {
  const trimmed = query.trim();
  if (!trimmed) return [{ text, match: false }];

  const pattern = new RegExp(escapeRegExp(trimmed), 'gi');
  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), match: false });
    }
    segments.push({ text: match[0], match: true });
    lastIndex = match.index + match[0].length;
  }

  if (segments.length === 0) return [{ text, match: false }];
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), match: false });
  }
  return segments;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
