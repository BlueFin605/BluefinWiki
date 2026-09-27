/**
 * Pure helper: rewrite the width of a single `![alt|WIDTH](url)` token in a
 * markdown string. Backs the preview drag-to-resize handle (step 3.7) — the
 * `WikiImage` handle reports a new pixel width, `page-detail` calls this against
 * the CodeMirror working buffer, and the debounced autosave persists it.
 *
 * `target` selects the image to rewrite:
 *  - `number` — the zero-based index of the image token in document order.
 *  - `string` — the (size-stripped) alt text of the image token.
 *
 * `width` is a pixel value; a non-positive value strips the `|WIDTH` suffix.
 * Mirrors `remark-image-size`'s `SIZE_PATTERN` so a width it emits round-trips.
 * Returns the markdown unchanged when nothing matches.
 *
 * Image-looking text inside fenced code blocks (``` ``` ``` / `~~~`) and inline
 * code spans (`` `…` ``) is ignored: those regions are masked out before
 * matching so a `![alt](x.png)` in a code sample is never rewritten and does not
 * advance the numeric index.
 */
const IMAGE_TOKEN = /!\[([^\]]*)\]\(([^)]*)\)/g;
const SIZE_SUFFIX = /^(.*?)\|(\d+%?(?:x\d+%?)?)$/;

// A fenced code block: a line opening with 3+ backticks or tildes, its content,
// and a matching closing fence (or the end of the document if never closed).
const FENCED_CODE =
  /(^|\n)([ \t]*)(`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?\n[ \t]*\3[ \t]*(?=\n|$)|[\s\S]*$)/g;
// An inline code span: a run of backticks, the shortest content, the same run.
const INLINE_CODE = /(`+)[\s\S]*?\1/g;

/** Replace every non-newline character with a space, preserving length + lines. */
function blank(segment: string): string {
  return segment.replace(/[^\n]/g, ' ');
}

/** Same-length copy of `markdown` with code regions blanked out. */
function maskCode(markdown: string): string {
  return markdown.replace(FENCED_CODE, blank).replace(INLINE_CODE, blank);
}

export function setImageWidth(
  markdown: string,
  target: number | string,
  width: number,
): string {
  const masked = maskCode(markdown);

  let index = -1;
  let result = '';
  let lastEnd = 0;
  IMAGE_TOKEN.lastIndex = 0;

  for (
    let match = IMAGE_TOKEN.exec(masked);
    match !== null;
    match = IMAGE_TOKEN.exec(masked)
  ) {
    index += 1;
    const rawAlt = match[1];
    const url = match[2];
    const sizeMatch = SIZE_SUFFIX.exec(rawAlt);
    const baseAlt = sizeMatch ? sizeMatch[1] : rawAlt;

    const isMatch =
      typeof target === 'number'
        ? index === target
        : baseAlt.trim() === target.trim();
    if (!isMatch) continue;

    const nextAlt = width > 0 ? `${baseAlt}|${Math.round(width)}` : baseAlt;
    result += markdown.slice(lastEnd, match.index) + `![${nextAlt}](${url})`;
    lastEnd = match.index + match[0].length;
  }

  return result + markdown.slice(lastEnd);
}
