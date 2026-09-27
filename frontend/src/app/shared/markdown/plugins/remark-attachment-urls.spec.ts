import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Image } from 'mdast';
import remarkAttachmentUrls, { type AttachmentUrlsOptions } from './remark-attachment-urls';

function imageUrls(markdown: string, options?: AttachmentUrlsOptions): string[] {
  const parsed = unified().use(remarkParse).parse(markdown);
  const tree = unified()
    .use(remarkParse)
    .use(remarkAttachmentUrls, options)
    .runSync(parsed);
  const urls: string[] = [];
  visit(tree, 'image', (node: Image) => urls.push(node.url));
  return urls;
}

describe('remark-attachment-urls', () => {
  it('rewrites a bare filename to the attachments endpoint', () => {
    expect(imageUrls('![alt](name.png)', { pageGuid: 'g1' })).toEqual([
      '/api/pages/g1/attachments/name.png',
    ]);
  });

  it('leaves an http(s) URL untouched', () => {
    expect(imageUrls('![alt](http://example.com/pic.png)', { pageGuid: 'g1' })).toEqual([
      'http://example.com/pic.png',
    ]);
    expect(imageUrls('![alt](https://example.com/pic.png)', { pageGuid: 'g1' })).toEqual([
      'https://example.com/pic.png',
    ]);
  });

  it('leaves a data: URL untouched', () => {
    const md = '![alt](data:image/png;base64,AAAA)';
    expect(imageUrls(md, { pageGuid: 'g1' })).toEqual(['data:image/png;base64,AAAA']);
  });

  it('normalises the legacy `<guid>/<filename>` form to the current page', () => {
    expect(
      imageUrls('![alt](11111111-2222-3333-4444-555555555555/name.png)', { pageGuid: 'g1' }),
    ).toEqual(['/api/pages/g1/attachments/name.png']);
  });

  it('is a no-op when no pageGuid is supplied (relative URL left alone)', () => {
    expect(imageUrls('![alt](name.png)')).toEqual(['name.png']);
    expect(imageUrls('![alt](name.png)', {})).toEqual(['name.png']);
  });

  it('is idempotent for an already-rewritten URL', () => {
    expect(
      imageUrls('![alt](/api/pages/g1/attachments/name.png)', { pageGuid: 'g1' }),
    ).toEqual(['/api/pages/g1/attachments/name.png']);
  });
});
