import { visit, SKIP } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Element } from 'hast';

const WRAPPER_CLASS = 'table-scroll';

function classListOf(node: Element): string[] {
  const cn = node.properties?.['className'];
  if (Array.isArray(cn)) return cn.map(String);
  if (typeof cn === 'string') return cn.split(/\s+/);
  return [];
}

/**
 * Rehype plugin: wrap every `<table>` in a `div.table-scroll` so wide tables
 * scroll horizontally inside the preview pane instead of widening the page
 * body. The renderer styles `.wiki-markdown .table-scroll` with
 * `overflow-x: auto`.
 *
 * The wrapper is a focusable, labelled `role="region"` (`tabIndex: 0`) so a
 * keyboard-only user can actually scroll a wide table (WCAG 2.1 SC 2.1.1) —
 * without `tabindex` the scroll container takes no focus and the overflow is
 * unreachable by keyboard.
 *
 * Runs on the HAST tree (after `remark-rehype`). Idempotent — a table already
 * inside a `div.table-scroll` is left alone — and it does not descend into the
 * wrapper it just created.
 */
const rehypeTableScroll: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table') return undefined;
      if (!parent || index === undefined) return undefined;
      if (
        parent.type === 'element' &&
        parent.tagName === 'div' &&
        classListOf(parent).includes(WRAPPER_CLASS)
      ) {
        return undefined;
      }

      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: [WRAPPER_CLASS],
          tabIndex: 0,
          role: 'region',
          'aria-label': 'Table',
        },
        children: [node],
      };
      parent.children[index] = wrapper;
      // Skip the freshly-inserted wrapper so we don't re-visit the same table.
      return [SKIP, index + 1];
    });
  };
};

export default rehypeTableScroll;
