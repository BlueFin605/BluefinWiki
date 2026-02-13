/**
 * Remark plugin for parsing and rendering wiki-style links
 * 
 * This plugin transforms wiki-style links ([[Page Title]] or [[guid|Display Text]])
 * into custom React components that can:
 * - Display styled wiki links
 * - Indicate broken/unresolved links
 * - Navigate to wiki pages
 * 
 * The plugin runs during the markdown parsing phase and converts wiki link syntax
 * into custom nodes that react-markdown can render with custom components.
 */

import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text, Link } from 'mdast';
import { parseWikiLinks, getDisplayText, type WikiLink } from '../utils/wikiLinkParser';

/**
 * Configuration options for the wiki links plugin
 */
export interface WikiLinksOptions {
  /**
   * Base path for wiki page URLs
   * @default '/wiki'
   */
  baseUrl?: string;

  /**
   * Function to resolve a page title or GUID to a URL
   * If not provided, uses default URL generation
   */
  resolveUrl?: (target: string, type: 'page-title' | 'page-guid') => string;

  /**
   * Function to check if a page exists (for broken link detection)
   * If not provided, all links are assumed to be valid
   */
  pageExists?: (target: string, type: 'page-title' | 'page-guid') => boolean;

  /**
   * Class name for valid wiki links
   * @default 'wiki-link'
   */
  linkClassName?: string;

  /**
   * Class name for broken wiki links
   * @default 'wiki-link-broken'
   */
  brokenLinkClassName?: string;
}

/**
 * Remark plugin to parse wiki-style links and convert them to markdown links
 * 
 * This plugin:
 * 1. Finds all wiki link patterns [[...]] in text nodes
 * 2. Parses them into structured WikiLink objects
 * 3. Converts them to standard markdown link nodes with special data attributes
 * 4. Allows react-markdown to render them with custom components
 */
const remarkWikiLinks: Plugin<[WikiLinksOptions?], Root> = (options = {}) => {
  const {
    baseUrl = '/wiki',
    resolveUrl,
    pageExists,
    linkClassName = 'wiki-link',
    brokenLinkClassName = 'wiki-link-broken',
  } = options;

  /**
   * Generate a URL for a wiki link target
   */
  function generateUrl(target: string, type: 'page-title' | 'page-guid'): string {
    if (resolveUrl) {
      return resolveUrl(target, type);
    }

    // Default URL generation
    if (type === 'page-guid') {
      return `${baseUrl}/${target}`;
    }

    // Convert page title to URL slug
    const slug = target
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${baseUrl}/${slug}`;
  }

  /**
   * Check if a link is broken (page doesn't exist)
   */
  function isBroken(target: string, type: 'page-title' | 'page-guid'): boolean {
    if (!pageExists) {
      return false; // Assume all links are valid if no checker provided
    }
    return !pageExists(target, type);
  }

  /**
   * Convert a WikiLink to a markdown Link node
   */
  function wikiLinkToMdastLink(wikiLink: WikiLink): Link {
    const url = generateUrl(wikiLink.target, wikiLink.type);
    const displayText = getDisplayText(wikiLink);
    const broken = isBroken(wikiLink.target, wikiLink.type);

    // Create the link node with data attributes for styling
    const linkNode: Link = {
      type: 'link',
      url,
      title: broken ? `Page not found: ${wikiLink.target}` : wikiLink.target,
      children: [
        {
          type: 'text',
          value: displayText,
        },
      ],
      data: {
        hProperties: {
          className: broken ? brokenLinkClassName : linkClassName,
          'data-wiki-link': 'true',
          'data-wiki-type': wikiLink.type,
          'data-wiki-target': wikiLink.target,
          'data-broken': broken ? 'true' : 'false',
        },
      },
    };

    return linkNode;
  }

  /**
   * Process a text node and split it into text and link nodes
   */
  function processTextNode(node: Text): (Text | Link)[] {
    const text = node.value;
    const wikiLinks = parseWikiLinks(text);

    // If no wiki links found, return original node
    if (wikiLinks.length === 0) {
      return [node];
    }

    const nodes: (Text | Link)[] = [];
    let lastIndex = 0;

    // Split the text node at each wiki link
    for (const wikiLink of wikiLinks) {
      // Add text before the link
      if (wikiLink.startIndex > lastIndex) {
        nodes.push({
          type: 'text',
          value: text.substring(lastIndex, wikiLink.startIndex),
        });
      }

      // Add the link node
      nodes.push(wikiLinkToMdastLink(wikiLink));

      lastIndex = wikiLink.endIndex;
    }

    // Add remaining text after last link
    if (lastIndex < text.length) {
      nodes.push({
        type: 'text',
        value: text.substring(lastIndex),
      });
    }

    return nodes;
  }

  /**
   * Visit all text nodes and process wiki links
   */
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) {
        return;
      }

      const processedNodes = processTextNode(node);

      // If the text was split into multiple nodes, replace the original node
      if (processedNodes.length > 1) {
        parent.children.splice(index, 1, ...processedNodes);
        
        // Return the index to continue visiting from the right position
        return index;
      }
    });
  };
};

export default remarkWikiLinks;
