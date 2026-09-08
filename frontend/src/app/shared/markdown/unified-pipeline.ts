import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import remarkWikiLinks, { type WikiLinksOptions } from './plugins/remark-wiki-links';
import remarkImageSize from './plugins/remark-image-size';
import remarkAttachmentUrls, { type AttachmentUrlsOptions } from './plugins/remark-attachment-urls';

export interface MarkdownPipelineOptions {
  wikiLinks?: WikiLinksOptions;
  attachments?: AttachmentUrlsOptions;
}

/**
 * Build the unified processor used by `<wiki-markdown-renderer>`.
 *
 * The order matches the React app's `MarkdownPreview`:
 *  1. remark-parse  — markdown → mdast
 *  2. remark-gfm    — tables, task lists, strikethrough, autolinks
 *  3. remark-breaks — soft \n → <br>
 *  4. remark-wiki-links — [[Title]] / [[guid|alias]] → <a data-wiki-link>
 *  5. remark-image-size — ![alt|SIZE](url) → <img width/height>
 *  6. remark-attachment-urls — bare/legacy image URL → /api/pages/:guid/attachments/:file
 *  7. remark-rehype  — mdast → hast
 *  8. rehype-highlight — code-block class → hljs token spans
 *
 * Return type: the bare `Processor` form (all type params at their `undefined`
 * defaults). The full inferred type of the chain is a deeply-nested generic
 * that changes whenever a plugin is added or removed — exporting it as a stable
 * `Processor` surface keeps callers decoupled from those internals.
 * Callers that need the richer inferred type can use `ReturnType<typeof buildMarkdownPipeline>`.
 *
 * The returned processor is configured for parse + runSync (sync mdast → hast).
 * Callers that need an async pipeline (e.g. with future rehype plugins that
 * require I/O) can replace `runSync` with `run`.
 */
export function buildMarkdownPipeline(
  options: MarkdownPipelineOptions = {},
) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkWikiLinks, options.wikiLinks)
    .use(remarkImageSize)
    .use(remarkAttachmentUrls, options.attachments)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeHighlight, { detect: true, ignoreMissing: true });
}
