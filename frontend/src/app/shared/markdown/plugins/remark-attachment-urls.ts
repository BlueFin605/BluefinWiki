import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Image } from 'mdast';

export interface AttachmentUrlsOptions {
  /**
   * The guid of the page the preview belongs to. Bare-filename image URLs are
   * rewritten to `/api/pages/<pageGuid>/attachments/<filename>`. When omitted
   * the plugin is a no-op — relative URLs are left exactly as authored.
   */
  pageGuid?: string;
}

/** A URI scheme (`http:`, `https:`, `data:`, `blob:`, `mailto:`, …) or `//`. */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
/** Leading `<guid>/` — the legacy `<guid>/<filename>` attachment reference. */
const LEGACY_GUID_PREFIX = /^[0-9a-f][0-9a-f-]{14,}\//i;

/**
 * Remark plugin: rewrite attachment-backed image URLs so the preview can load
 * them through the authed API. Ports React's `MarkdownPreview` URL rewrite.
 *
 *  - bare `name.png`            → `/api/pages/<guid>/attachments/name.png`
 *  - legacy `<guid>/name.png`   → `/api/pages/<guid>/attachments/name.png`
 *  - `http(s)://…`, `data:…`    → untouched (external images render directly)
 *  - `#anchor`                  → untouched
 *  - already-rewritten `/api/…` → untouched (idempotent)
 *
 * Runs before `remark-rehype`; `<wiki-markdown-renderer>` then hydrates the
 * resulting `<img>` into a `<wiki-image>` which resolves the presigned URL.
 */
const remarkAttachmentUrls: Plugin<[AttachmentUrlsOptions?], Root> = (options = {}) => {
  const pageGuid = options.pageGuid?.trim();
  return (tree: Root) => {
    if (!pageGuid) return;
    visit(tree, 'image', (node: Image) => {
      const url = node.url?.trim();
      if (!url) return;
      if (ABSOLUTE.test(url)) return;
      if (url.startsWith('#')) return;
      if (url.startsWith('/api/pages/')) return;

      const filename = url.replace(LEGACY_GUID_PREFIX, '').replace(/^\.?\//, '');
      if (!filename) return;
      node.url = `/api/pages/${pageGuid}/attachments/${filename}`;
    });
  };
};

export default remarkAttachmentUrls;
