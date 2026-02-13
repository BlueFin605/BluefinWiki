/**
 * Wiki Link Parser Utility
 * 
 * Parses wiki-style links with the following formats:
 * - [[Page Title]] - Basic wiki link using page title
 * - [[guid|Display Text]] - Wiki link using GUID with custom display text
 * - External links are handled by standard markdown: [text](url)
 */

export interface WikiLink {
  type: 'page-title' | 'page-guid';
  raw: string;
  target: string; // Page title or GUID
  displayText?: string; // Custom display text (for GUID format)
  startIndex: number;
  endIndex: number;
}

/**
 * Regex pattern for wiki links:
 * - Matches [[Page Title]] or [[guid|Display Text]]
 * - Captures the content between [[ and ]]
 */
const WIKI_LINK_REGEX = /\[\[([^\]]+?)\]\]/g;

/**
 * Parse a markdown string and extract all wiki links
 * 
 * @param markdown - The markdown content to parse
 * @returns Array of WikiLink objects
 */
export function parseWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  WIKI_LINK_REGEX.lastIndex = 0;

  while ((match = WIKI_LINK_REGEX.exec(markdown)) !== null) {
    const raw = match[0];
    const content = match[1];
    const startIndex = match.index;
    const endIndex = match.index + raw.length;

    // Check if content contains pipe separator (guid|display text format)
    const pipeIndex = content.indexOf('|');

    if (pipeIndex !== -1) {
      // Format: [[guid|Display Text]]
      const target = content.substring(0, pipeIndex).trim();
      const displayText = content.substring(pipeIndex + 1).trim();

      links.push({
        type: 'page-guid',
        raw,
        target,
        displayText,
        startIndex,
        endIndex,
      });
    } else {
      // Format: [[Page Title]]
      const target = content.trim();

      links.push({
        type: 'page-title',
        raw,
        target,
        startIndex,
        endIndex,
      });
    }
  }

  return links;
}

/**
 * Check if a link target is a valid GUID format
 * UUIDs are 36 characters with hyphens: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * 
 * @param target - The link target to validate
 * @returns True if target appears to be a GUID
 */
export function isGuid(target: string): boolean {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return guidRegex.test(target);
}

/**
 * Validate if a wiki link is properly formatted
 * 
 * @param link - The wiki link text (without [[ ]])
 * @returns True if link is valid
 */
export function isValidWikiLink(link: string): boolean {
  if (!link || link.trim().length === 0) {
    return false;
  }

  // Check for pipe separator
  const pipeIndex = link.indexOf('|');

  if (pipeIndex !== -1) {
    // Format: [[guid|Display Text]]
    const target = link.substring(0, pipeIndex).trim();
    const displayText = link.substring(pipeIndex + 1).trim();

    // Both parts must be non-empty
    if (!target || !displayText) {
      return false;
    }

    // Target should be a GUID
    return isGuid(target);
  }

  // Format: [[Page Title]] - just needs non-empty content
  return link.trim().length > 0;
}

/**
 * Convert a wiki link to its display text
 * 
 * @param link - The parsed wiki link
 * @returns The text to display for the link
 */
export function getDisplayText(link: WikiLink): string {
  if (link.displayText) {
    return link.displayText;
  }
  return link.target;
}

/**
 * Detect if text contains any external URL indicators
 * This helps distinguish between wiki links and external markdown links
 * 
 * @param text - Text to check
 * @returns True if text appears to contain an external URL
 */
export function hasExternalUrl(text: string): boolean {
  const urlPatterns = [
    /^https?:\/\//i,
    /^ftp:\/\//i,
    /^mailto:/i,
  ];

  return urlPatterns.some(pattern => pattern.test(text));
}
