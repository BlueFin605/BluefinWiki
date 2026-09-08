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
 */
const IMAGE_TOKEN = /!\[([^\]]*)\]\(([^)]*)\)/g;
const SIZE_SUFFIX = /^(.*?)\|(\d+%?(?:x\d+%?)?)$/;

export function setImageWidth(
  markdown: string,
  target: number | string,
  width: number,
): string {
  let index = -1;
  return markdown.replace(IMAGE_TOKEN, (match, rawAlt: string, url: string) => {
    index += 1;
    const sizeMatch = SIZE_SUFFIX.exec(rawAlt);
    const baseAlt = sizeMatch ? sizeMatch[1] : rawAlt;

    const isMatch =
      typeof target === 'number'
        ? index === target
        : baseAlt.trim() === target.trim();
    if (!isMatch) return match;

    const nextAlt = width > 0 ? `${baseAlt}|${Math.round(width)}` : baseAlt;
    return `![${nextAlt}](${url})`;
  });
}
