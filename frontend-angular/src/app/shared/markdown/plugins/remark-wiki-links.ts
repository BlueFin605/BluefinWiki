/**
 * Remark plugin that converts wiki-link syntax (`[[Title]]` or `[[guid|alias]]`)
 * into mdast `link` nodes annotated with `data.hProperties` for downstream
 * HAST consumption.
 *
 * **hProperties key casing — important:** keys are emitted in camelCase
 * (`dataWikiLink`, `dataWikiType`, `dataWikiTarget`, `dataBroken`, `className`)
 * rather than the hyphenated HTML form. `mdast-util-to-hast` (invoked by
 * `remark-rehype`) copies `hProperties` **verbatim** onto the HAST element's
 * `properties` map — it does not normalize key casing. The `MarkdownRenderer`
 * HAST walker reads these properties directly (e.g. `properties['dataWikiLink']
 * === 'true'`), so the keys must be camelCase at the source.
 * `rehype-stringify` (via `property-information`) still serializes these to
 * the canonical kebab-case HTML attributes (`data-wiki-link="true"` etc.).
 * Renaming the keys to hyphenated form will break the HAST renderer's
 * detection without any test failure in the plugin's own HTML-output tests.
 */
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text, Link, Code, InlineCode } from 'mdast';
import { parseWikiLinks, getDisplayText, type WikiLink } from '../wiki-link-parser';

export interface WikiLinksOptions {
  baseUrl?: string;
  resolveUrl?: (target: string, type: 'page-title' | 'page-guid') => string;
  pageExists?: (target: string, type: 'page-title' | 'page-guid') => boolean;
  linkClassName?: string;
  brokenLinkClassName?: string;
}

const remarkWikiLinks: Plugin<[WikiLinksOptions?], Root> = (options = {}) => {
  const {
    baseUrl = '/wiki',
    resolveUrl,
    pageExists,
    linkClassName = 'wiki-link',
    brokenLinkClassName = 'wiki-link-broken',
  } = options;

  function generateUrl(target: string, type: 'page-title' | 'page-guid'): string {
    if (resolveUrl) return resolveUrl(target, type);
    if (type === 'page-guid') return `${baseUrl}/${target}`;
    const slug = target.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${baseUrl}/${slug}`;
  }

  function isBroken(target: string, type: 'page-title' | 'page-guid'): boolean {
    return pageExists ? !pageExists(target, type) : false;
  }

  function wikiLinkToMdastLink(wikiLink: WikiLink): Link {
    const url = generateUrl(wikiLink.target, wikiLink.type);
    const displayText = getDisplayText(wikiLink);
    const broken = isBroken(wikiLink.target, wikiLink.type);
    return {
      type: 'link',
      url,
      title: broken ? `Page not found: ${wikiLink.target}` : wikiLink.target,
      children: [{ type: 'text', value: displayText }],
      data: {
        hProperties: {
          className: broken ? brokenLinkClassName : linkClassName,
          // Use camelCase keys so that mdast-util-to-hast copies them verbatim
          // onto the HAST element's `properties` map. property-information maps
          // both `data-wiki-link` and `dataWikiLink` to the same attribute, so
          // rehype-stringify still emits `data-wiki-link="true"` in HTML.
          dataWikiLink: 'true',
          dataWikiType: wikiLink.type,
          dataWikiTarget: wikiLink.target,
          dataBroken: broken ? 'true' : 'false',
        },
      },
    };
  }

  function processTextNode(node: Text): (Text | Link)[] {
    const text = node.value;
    const wikiLinks = parseWikiLinks(text);
    if (wikiLinks.length === 0) return [node];

    const nodes: (Text | Link)[] = [];
    let lastIndex = 0;
    for (const link of wikiLinks) {
      if (link.startIndex > lastIndex) {
        nodes.push({ type: 'text', value: text.substring(lastIndex, link.startIndex) });
      }
      nodes.push(wikiLinkToMdastLink(link));
      lastIndex = link.endIndex;
    }
    if (lastIndex < text.length) {
      nodes.push({ type: 'text', value: text.substring(lastIndex) });
    }
    return nodes;
  }

  return (tree: Root) => {
    // `visit` will not descend into `code` / `inlineCode` because they're leaf
    // nodes (no `children: Text[]` — they carry `value` directly). That's how
    // the existing React plugin gets fenced-code/backtick-code exclusion for
    // free.
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return undefined;
      // Defensive: never rewrite text inside `code` or `inlineCode` parents (in
      // case a custom remark plugin elsewhere emits `text` children of them).
      const parentType = (parent as { type: string }).type;
      if (parentType === ('code' satisfies Code['type']) || parentType === ('inlineCode' satisfies InlineCode['type'])) {
        return undefined;
      }
      const processed = processTextNode(node);
      if (processed.length !== 1 || processed[0] !== node) {
        parent.children.splice(index, 1, ...processed);
        return index;
      }
      return undefined;
    });
  };
};

export default remarkWikiLinks;
