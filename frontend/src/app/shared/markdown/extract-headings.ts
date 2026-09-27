import { slugify } from './slugify';

/** One table-of-contents entry derived from an ATX heading in the source. */
export interface TocHeading {
  /** Heading level, 2–6 (`#`/h1 is never captured). */
  level: number;
  /** Visible heading text: closing `#`s and inline link/image syntax removed. */
  text: string;
  /** Anchor id — {@link slugify}(text); matches the id the renderer stamps. */
  slug: string;
}

/**
 * Reduce inline link / image markup to the text the renderer would slugify.
 * `markdown-renderer` slugifies a heading's *rendered* text (`slugify(textOf(node))`),
 * so `## See [the docs](/guide)` gets the id `see-the-docs` — the `/guide` URL is
 * gone. `extractHeadings` works off the raw source line, so it must strip the
 * same syntax or `document.getElementById` misses that entry.
 *
 * - `[text](url)` / `[text][ref]` → `text` (renderer keeps the link's text).
 * - `![alt](url)` / `![alt][ref]` → `` (an `<img>` is a void element, so
 *   `textOf` contributes nothing — the alt text is NOT in the renderer's id).
 *
 * Shortcut references (`[text]`) are left as-is: `slugify` strips the brackets,
 * and the renderer's id ends up identical whether or not the reference resolves.
 */
function stripInlineMarkup(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
}

/** Opening or closing fence for a code block: ``` or ~~~ (>= 3), <= 3 indent. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * ATX heading, level 2–6. `#{2,6}` deliberately excludes `#` (h1) — parity with
 * React's TableOfContents, which lists sub-sections only — and 7+ hashes, which
 * are not headings. A closing run of `#`s (`## Foo ##`) is stripped.
 */
const ATX_HEADING = /^ {0,3}(#{2,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;

/**
 * Pure scan of markdown source for headings the table of contents should list:
 * ATX levels 2–6, skipping anything inside a fenced code block. Slugs come from
 * the shared {@link slugify} so each entry lines up with the `id` the markdown
 * renderer puts on the corresponding heading element.
 */
export function extractHeadings(markdown: string): TocHeading[] {
  const src = markdown ?? '';
  if (!src.trim()) return [];

  const headings: TocHeading[] = [];
  let fenceMarker: string | null = null;

  for (const line of src.split(/\r?\n/)) {
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      if (fenceMarker === null) fenceMarker = marker;
      else if (fenceMarker === marker) fenceMarker = null;
      continue;
    }
    if (fenceMarker !== null) continue;

    const m = ATX_HEADING.exec(line);
    if (!m) continue;
    const text = stripInlineMarkup(m[2]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    headings.push({ level: m[1].length, text, slug: slugify(text) });
  }

  return headings;
}
