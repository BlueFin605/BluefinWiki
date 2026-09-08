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
