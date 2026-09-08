/**
 * GitHub-style heading slug: lower-cased, trimmed, punctuation stripped, runs of
 * whitespace collapsed to single dashes.
 *
 * Single source of truth for heading anchor ids. `markdown-renderer` stamps this
 * onto every rendered heading (`<h2 [id]>` …) and `extract-headings` re-derives
 * the same value from the raw markdown so the table of contents can look each
 * heading element back up with `document.getElementById(slug)`.
 *
 * Behaviour is intentionally identical to the original private helper that lived
 * in `markdown-renderer.ts` — do not "improve" it here without updating both
 * consumers and their specs.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}
