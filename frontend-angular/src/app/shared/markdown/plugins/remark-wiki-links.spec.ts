import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkWikiLinks from './remark-wiki-links';
import type { Root } from 'mdast';

async function toHtml(markdown: string, options?: Parameters<typeof remarkWikiLinks>[0]): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkWikiLinks, options)
    .use(remarkRehype)
    .use(await import('rehype-stringify').then((m) => m.default))
    .process(markdown);
  return String(file);
}

async function toMdast(markdown: string, options?: Parameters<typeof remarkWikiLinks>[0]): Promise<Root> {
  const processor = unified().use(remarkParse).use(remarkWikiLinks, options);
  const tree = processor.parse(markdown);
  return processor.run(tree) as Promise<Root>;
}

describe('remark-wiki-links', () => {
  it('converts [[Title]] to a link node with default slug url', async () => {
    const html = await toHtml('Read [[Getting Started]] now.');
    expect(html).toContain('href="/wiki/getting-started"');
    expect(html).toContain('class="wiki-link"');
    expect(html).toContain('data-wiki-link="true"');
    expect(html).toContain('data-wiki-type="page-title"');
    expect(html).toContain('data-wiki-target="Getting Started"');
    expect(html).toContain('>Getting Started</a>');
  });

  it('converts [[guid|alias]] to a link node with guid url and alias text', async () => {
    const html = await toHtml('See [[550e8400-e29b-41d4-a716-446655440000|Home]] here.');
    expect(html).toContain('href="/wiki/550e8400-e29b-41d4-a716-446655440000"');
    expect(html).toContain('data-wiki-type="page-guid"');
    expect(html).toContain('>Home</a>');
  });

  it('marks broken links via pageExists callback', async () => {
    const html = await toHtml('[[Missing Page]]', { pageExists: () => false });
    expect(html).toContain('class="wiki-link-broken"');
    expect(html).toContain('data-broken="true"');
  });

  it('uses custom resolveUrl when provided', async () => {
    const html = await toHtml('[[Custom]]', {
      resolveUrl: (target) => `/custom/${target.toUpperCase()}`,
    });
    expect(html).toContain('href="/custom/CUSTOM"');
  });

  it('respects custom baseUrl', async () => {
    const html = await toHtml('[[Hello World]]', { baseUrl: '/pages' });
    expect(html).toContain('href="/pages/hello-world"');
  });

  it('does not process wiki links inside code blocks', async () => {
    const html = await toHtml('```\n[[Not A Link]]\n```');
    expect(html).not.toContain('data-wiki-link');
    expect(html).toContain('[[Not A Link]]');
  });

  it('does not process wiki links inside inline code', async () => {
    const html = await toHtml('Use `[[syntax]]` to make links.');
    expect(html).not.toContain('data-wiki-link');
    expect(html).toContain('<code>[[syntax]]</code>');
  });

  it('handles multiple wiki links in one paragraph', async () => {
    const tree = await toMdast('[[A]] and [[B]] and [[C]].');
    const para = tree.children[0];
    expect(para.type).toBe('paragraph');
    const linkCount = (para as { children: { type: string }[] }).children.filter((c) => c.type === 'link').length;
    expect(linkCount).toBe(3);
  });
});
