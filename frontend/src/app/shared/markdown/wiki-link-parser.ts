export interface WikiLink {
  type: 'page-title' | 'page-guid';
  raw: string;
  target: string;
  displayText?: string;
  startIndex: number;
  endIndex: number;
}

const WIKI_LINK_REGEX = /\[\[([^\]]+?)\]\]/g;

export function parseWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;
  WIKI_LINK_REGEX.lastIndex = 0;

  while ((match = WIKI_LINK_REGEX.exec(markdown)) !== null) {
    const raw = match[0];
    const content = match[1];
    const startIndex = match.index;
    const endIndex = match.index + raw.length;
    const pipeIndex = content.indexOf('|');

    if (pipeIndex !== -1) {
      links.push({
        type: 'page-guid',
        raw,
        target: content.substring(0, pipeIndex).trim(),
        displayText: content.substring(pipeIndex + 1).trim(),
        startIndex,
        endIndex,
      });
    } else {
      links.push({
        type: 'page-title',
        raw,
        target: content.trim(),
        startIndex,
        endIndex,
      });
    }
  }
  return links;
}

export function isGuid(target: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
}

export function isValidWikiLink(link: string): boolean {
  if (!link || link.trim().length === 0) return false;
  const pipeIndex = link.indexOf('|');
  if (pipeIndex !== -1) {
    const target = link.substring(0, pipeIndex).trim();
    const displayText = link.substring(pipeIndex + 1).trim();
    if (!target || !displayText) return false;
    return isGuid(target);
  }
  return link.trim().length > 0;
}

export function getDisplayText(link: WikiLink): string {
  return link.displayText ?? link.target;
}

export function hasExternalUrl(text: string): boolean {
  return /^https?:\/\//i.test(text) || /^ftp:\/\//i.test(text) || /^mailto:/i.test(text);
}
