/**
 * Markdown Stripper
 *
 * Strips markdown formatting from content to produce plain text
 * suitable for search indexing.
 */

/**
 * Strip markdown formatting from content, producing plain text.
 *
 * Removes:
 * - Code blocks (fenced and indented)
 * - Inline code
 * - Headers (# syntax)
 * - Bold/italic markers
 * - Links (keeps link text)
 * - Images (keeps alt text)
 * - HTML tags
 * - Blockquotes
 * - Horizontal rules
 * - List markers
 * - Wiki links ([[...]])
 * - Mermaid diagrams
 *
 * @param markdown - Raw markdown content
 * @returns Plain text content
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // Remove mermaid code blocks entirely
  text = text.replace(/```mermaid[\s\S]*?```/g, '');

  // Remove fenced code blocks (keep nothing — code is not useful for search)
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Remove images (keep alt text)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove links (keep link text)
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove wiki links [[target|display]] or [[target]]
  text = text.replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, '$2');
  text = text.replace(/\[\[([^\]]*)\]\]/g, '$1');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Remove headers (# syntax)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove bold and italic markers
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/___([^_]+)___/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // Remove strikethrough
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // Remove blockquote markers
  text = text.replace(/^>\s?/gm, '');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove unordered list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');

  // Remove ordered list markers
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove table formatting
  text = text.replace(/\|/g, ' ');
  text = text.replace(/^[-:|\s]+$/gm, '');

  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Collapse multiple spaces
  text = text.replace(/ {2,}/g, ' ');

  // Trim
  text = text.trim();

  return text;
}
