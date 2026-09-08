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

  // ---- Step 3.8: resolveWikiTarget -> GUID href + broken flag --------------

  type LinkHast = {
    children: { tagName?: string; children?: { tagName?: string; properties?: Record<string, unknown> }[] }[];
  };

  function firstLink(hast: unknown) {
    const root = hast as LinkHast;
    for (const block of root.children) {
      const link = block.children?.find((c) => c.tagName === 'a');
      if (link) return link;
    }
    return undefined;
  }

  it('resolves [[Title]] to a /pages/<guid> href via resolveWikiTarget', () => {
    const pipeline = buildMarkdownPipeline({
      wikiLinks: { resolveWikiTarget: () => ({ guid: 'g1', exists: true }) },
    });
    const link = firstLink(pipeline.runSync(pipeline.parse('See [[Some Page]] now.')));
    expect(link?.properties?.['href']).toBe('/pages/g1');
    expect(link?.properties?.['dataBroken']).toBe('false');
  });

  it('marks [[Title]] broken (data-broken) when resolveWikiTarget reports exists:false', () => {
    const pipeline = buildMarkdownPipeline({
      wikiLinks: { resolveWikiTarget: () => ({ guid: 'x9', exists: false }) },
    });
    const link = firstLink(pipeline.runSync(pipeline.parse('[[Ghost]]')));
    expect(link?.properties?.['dataBroken']).toBe('true');
    expect(link?.properties?.['href']).toBe('/pages/x9');
  });

  it('uses a guid target directly for [[guid|alias]] links, ignoring the resolver guid', () => {
    const guid = '550e8400-e29b-41d4-a716-446655440000';
    const pipeline = buildMarkdownPipeline({
      wikiLinks: { resolveWikiTarget: () => ({ guid: 'SHOULD-NOT-BE-USED', exists: true }) },
    });
    const link = firstLink(pipeline.runSync(pipeline.parse(`See [[${guid}|Home]] here.`)));
    expect(link?.properties?.['href']).toBe(`/pages/${guid}`);
  });

  it('resolves each distinct target only once per render pass', () => {
    const calls: string[] = [];
    const pipeline = buildMarkdownPipeline({
      wikiLinks: {
        resolveWikiTarget: (t) => {
          calls.push(t);
          return { guid: t, exists: true };
        },
      },
    });
    pipeline.runSync(pipeline.parse('[[A]] then [[A]] again then [[B]]'));
    expect(calls).toEqual(['A', 'B']);
  });
});
