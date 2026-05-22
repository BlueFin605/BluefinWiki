import { buildMarkdownPipeline } from './unified-pipeline';

describe('buildMarkdownPipeline', () => {
  it('parses plain markdown to a HAST root', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('# Hello');
    const hast = pipeline.runSync(mdast);
    expect(hast.type).toBe('root');
    const root = hast as { children: { type: string; tagName?: string }[] };
    expect(root.children[0].tagName).toBe('h1');
  });

  it('renders GFM tables (proves remark-gfm wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('| a | b |\n|---|---|\n| 1 | 2 |');
    const hast = pipeline.runSync(mdast);
    const root = hast as { children: { type: string; tagName?: string }[] };
    expect(root.children.some((c) => c.tagName === 'table')).toBe(true);
  });

  it('converts soft breaks to <br> (proves remark-breaks wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('line one\nline two');
    const hast = pipeline.runSync(mdast) as {
      children: { tagName?: string; children?: { tagName?: string }[] }[];
    };
    const para = hast.children.find((c) => c.tagName === 'p');
    expect(para?.children?.some((c) => c.tagName === 'br')).toBe(true);
  });

  it('marks wiki links via the plugin (proves remark-wiki-links wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('See [[Home]] now.');
    const hast = pipeline.runSync(mdast) as {
      children: { tagName?: string; children?: { tagName?: string; properties?: Record<string, unknown> }[] }[];
    };
    const para = hast.children.find((c) => c.tagName === 'p');
    const link = para?.children?.find((c) => c.tagName === 'a');
    expect(link?.properties?.['dataWikiLink']).toBe('true');
  });

  it('applies image sizing via the plugin (proves remark-image-size wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('![alt|123](image.png)');
    const hast = pipeline.runSync(mdast) as {
      children: { tagName?: string; children?: { tagName?: string; properties?: Record<string, unknown> }[] }[];
    };
    const para = hast.children.find((c) => c.tagName === 'p');
    const img = para?.children?.find((c) => c.tagName === 'img');
    expect(img?.properties?.['width']).toBe('123px');
  });

  it('applies syntax highlighting class to fenced code (proves rehype-highlight wired)', () => {
    const pipeline = buildMarkdownPipeline();
    const mdast = pipeline.parse('```ts\nconst x = 1;\n```');
    const hast = pipeline.runSync(mdast);
    const json = JSON.stringify(hast);
    expect(json).toMatch(/hljs/);
  });

  it('passes options through to remark-wiki-links', () => {
    const pipeline = buildMarkdownPipeline({
      wikiLinks: { pageExists: () => false },
    });
    const mdast = pipeline.parse('[[Missing]]');
    const hast = pipeline.runSync(mdast) as {
      children: { children?: { properties?: Record<string, unknown> }[] }[];
    };
    const link = hast.children[0].children?.[0];
    expect(link?.properties?.['dataBroken']).toBe('true');
  });
});
