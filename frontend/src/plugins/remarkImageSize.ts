/**
 * Remark plugin for Obsidian-style image sizing
 *
 * Syntax:
 *   ![alt|300](url)        → width 300px
 *   ![alt|300x200](url)    → width 300px, height 200px
 *   ![alt|50%](url)        → width 50%
 */

import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Image } from 'mdast';

// Match "alt text|SIZE" where SIZE is digits optionally followed by %, or WIDTHxHEIGHT
const SIZE_PATTERN = /^(.*?)\|(\d+%?(?:x\d+%?)?)$/;

const remarkImageSize: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'image', (node: Image) => {
      if (!node.alt) return;

      const match = node.alt.match(SIZE_PATTERN);
      if (!match) return;

      const [, cleanAlt, sizeStr] = match;
      node.alt = cleanAlt.trim();

      let width: string;
      let height: string | undefined;

      if (sizeStr.includes('x')) {
        const [w, h] = sizeStr.split('x');
        width = w.includes('%') ? w : `${w}px`;
        height = h ? (h.includes('%') ? h : `${h}px`) : undefined;
      } else {
        width = sizeStr.includes('%') ? sizeStr : `${sizeStr}px`;
      }

      // Attach as hProperties so rehype/react-markdown passes them as props
      const existing = (node.data?.hProperties as Record<string, unknown>) || {};
      node.data = node.data || {};
      node.data.hProperties = { ...existing, width, height };
    });
  };
};

export default remarkImageSize;
