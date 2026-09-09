/**
 * Pure helpers for the inspector Title <-> document H1 sync (step 4.3).
 *
 * React's Title field keeps a leading `# H1` line in the editor buffer in step
 * with the page Title: editing one rewrites the other. These helpers isolate
 * the string reasoning so both the panel behaviour and the CodeMirror
 * transaction bridge (`PageDetail.setFirstH1`) share one definition of "the
 * first non-empty line is an H1" and "rewrite that line".
 *
 * An H1 line is `^#\s+(.*)$` — a single `#`, then whitespace, then the text.
 * `## Sub` and `#NoSpace` are deliberately not H1s. Only the *first non-empty*
 * line is considered; leading blank lines are skipped.
 */

const H1_RE = /^#\s+.*$/;

/** Index of the first line with non-whitespace content, or -1 when there is none. */
function firstContentLineIndex(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) return i;
  }
  return -1;
}

/** True when the buffer's first non-empty line is a Markdown H1 (`# text`). */
export function firstLineIsH1(markdown: string): boolean {
  const lines = markdown.split('\n');
  const i = firstContentLineIndex(lines);
  return i >= 0 && H1_RE.test(lines[i]);
}

/**
 * Return `markdown` with its first non-empty line rewritten to `# <title>`
 * (title trimmed). If that line is not an H1 the buffer is returned unchanged —
 * callers rely on referential equality (`result === markdown`) as the
 * feedback-loop / no-op guard, so this never allocates a new string when
 * nothing changes.
 */
export function rewriteFirstH1(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  const i = firstContentLineIndex(lines);
  if (i < 0 || !H1_RE.test(lines[i])) return markdown;
  const next = `# ${title.trim()}`;
  if (lines[i] === next) return markdown;
  lines[i] = next;
  return lines.join('\n');
}

/**
 * Character range `[from, to)` of the first non-empty line when it is an H1,
 * else `null`. Used to build a minimal `view.dispatch({ changes })` transaction
 * so the rewrite lands in CodeMirror's undo history alongside typing.
 */
export function firstH1Range(markdown: string): { from: number; to: number } | null {
  const lines = markdown.split('\n');
  const i = firstContentLineIndex(lines);
  if (i < 0 || !H1_RE.test(lines[i])) return null;
  let from = 0;
  for (let j = 0; j < i; j++) from += lines[j].length + 1;
  return { from, to: from + lines[i].length };
}
