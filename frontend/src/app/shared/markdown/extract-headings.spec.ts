import { extractHeadings } from './extract-headings';
import { slugify } from './slugify';

describe('extractHeadings', () => {
  it('captures ## through ###### with level, text and slug', () => {
    const md = [
      '## Two',
      '### Three',
      '#### Four',
      '##### Five',
      '###### Six',
    ].join('\n');

    expect(extractHeadings(md)).toEqual([
      { level: 2, text: 'Two', slug: 'two' },
      { level: 3, text: 'Three', slug: 'three' },
      { level: 4, text: 'Four', slug: 'four' },
      { level: 5, text: 'Five', slug: 'five' },
      { level: 6, text: 'Six', slug: 'six' },
    ]);
  });

  it('excludes # (h1) headings — parity with React', () => {
    const md = '# Title\n\n## Section\n\n## Another';
    expect(extractHeadings(md).map((h) => h.text)).toEqual(['Section', 'Another']);
  });

  it('excludes 7+ hashes (not a valid heading)', () => {
    expect(extractHeadings('####### Seven')).toEqual([]);
  });

  it('ignores headings inside ``` fenced code blocks', () => {
    const md = [
      '## Real Heading',
      '',
      '```md',
      '## Not A Heading',
      '### Also Not',
      '```',
      '',
      '## After Fence',
    ].join('\n');

    expect(extractHeadings(md).map((h) => h.text)).toEqual([
      'Real Heading',
      'After Fence',
    ]);
  });

  it('ignores headings inside ~~~ fenced code blocks', () => {
    const md = ['~~~', '## Hidden', '~~~', '## Visible'].join('\n');
    expect(extractHeadings(md).map((h) => h.text)).toEqual(['Visible']);
  });

  it('produces slugs equal to the shared slugify()', () => {
    const md = '## Hello, World!\n### API & SDK notes';
    const headings = extractHeadings(md);
    expect(headings[0].slug).toBe(slugify('Hello, World!'));
    expect(headings[1].slug).toBe(slugify('API & SDK notes'));
  });

  describe('inline link / image markup (slug must match the renderer id)', () => {
    it('reduces an inline link to its visible text', () => {
      const [h] = extractHeadings('## See [the docs](/guide)');
      expect(h.text).toBe('See the docs');
      // renderer: slugify(textOf(node)) === slugify('See the docs')
      expect(h.slug).toBe(slugify('See the docs'));
      expect(h.slug).toBe('see-the-docs');
    });

    it('reduces a reference-style link to its visible text', () => {
      const [h] = extractHeadings('## Read the [manual][man] first');
      expect(h.text).toBe('Read the manual first');
      expect(h.slug).toBe(slugify('Read the manual first'));
    });

    it('drops an inline image entirely (renderer <img> contributes no text)', () => {
      const [h] = extractHeadings('## Logo ![brand alt](/logo.png) Here');
      expect(h.text).toBe('Logo Here');
      expect(h.slug).toBe(slugify('Logo Here'));
      expect(h.slug).toBe('logo-here');
    });

    it('handles a heading that is only a link', () => {
      const [h] = extractHeadings('### [Overview](/overview)');
      expect(h.text).toBe('Overview');
      expect(h.slug).toBe('overview');
    });
  });

  it('strips trailing closing hashes from ATX headings', () => {
    expect(extractHeadings('## Closed ##')[0]).toEqual({
      level: 2,
      text: 'Closed',
      slug: 'closed',
    });
  });

  it('returns an empty array for empty / whitespace / nullish input', () => {
    expect(extractHeadings('')).toEqual([]);
    expect(extractHeadings('   \n\n')).toEqual([]);
    expect(extractHeadings(undefined as unknown as string)).toEqual([]);
  });
});
