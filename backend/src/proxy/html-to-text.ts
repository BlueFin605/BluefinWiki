/**
 * Lightweight HTML → readable text extraction.
 *
 * Not as good as Mozilla's Readability, but zero dependencies and adequate for
 * giving the on-device AI enough context to summarise an article. We:
 *   1. Drop noisy elements entirely (script/style/nav/footer/aside/header/form).
 *   2. Prefer text inside <article>, <main>, or [role="main"] if present.
 *   3. Replace remaining tags with whitespace.
 *   4. Decode a handful of common HTML entities.
 *   5. Collapse whitespace.
 */

const NOISE_TAGS = ['script', 'style', 'nav', 'footer', 'aside', 'header', 'form', 'noscript', 'iframe', 'svg'];

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&rsquo;': '’',
};

export function htmlToText(html: string): string {
  let s = html;

  for (const tag of NOISE_TAGS) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
    s = s.replace(re, ' ');
    const selfClose = new RegExp(`<${tag}\\b[^>]*/?\\s*>`, 'gi');
    s = s.replace(selfClose, ' ');
  }

  const articleMatch =
    s.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
    s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
    s.match(/<[^>]+role\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i);

  if (articleMatch?.[1]) {
    s = articleMatch[1];
  } else {
    const bodyMatch = s.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch?.[1]) s = bodyMatch[1];
  }

  s = s.replace(/<!--[\s\S]*?-->/g, ' ');

  s = s.replace(/<(h[1-6]|p|div|li|br|tr)[^>]*>/gi, '\n');
  s = s.replace(/<\/(h[1-6]|p|div|li|tr)\s*>/gi, '\n');

  s = s.replace(/<[^>]+>/g, ' ');

  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = parseInt(n, 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
  });
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n) => {
    const code = parseInt(n, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
  });
  for (const [entity, char] of Object.entries(ENTITIES)) {
    s = s.split(entity).join(char);
  }

  s = s
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
}
