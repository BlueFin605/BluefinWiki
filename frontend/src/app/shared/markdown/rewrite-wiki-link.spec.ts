import { rewriteWikiLink } from './rewrite-wiki-link';

describe('rewriteWikiLink', () => {
  it('rewrites a bare [[Target]] to [[guid|Target]], using the target as display text', () => {
    const result = rewriteWikiLink('See [[Foo]] for more.', 'Foo', 'guid-1');
    expect(result).toBe('See [[guid-1|Foo]] for more.');
  });

  it('rewrites [[Target|text]] to [[guid|text]], preserving the existing display text', () => {
    const result = rewriteWikiLink('See [[Foo|bar]] for more.', 'Foo', 'guid-1');
    expect(result).toBe('See [[guid-1|bar]] for more.');
  });

  it('leaves a link with a different target untouched', () => {
    const result = rewriteWikiLink('See [[Foobar]] for more.', 'Foo', 'guid-1');
    expect(result).toBe('See [[Foobar]] for more.');
  });

  it('rewrites every occurrence of a repeated target', () => {
    const result = rewriteWikiLink('[[Foo]] and again [[Foo]] and [[Foo|alias]].', 'Foo', 'guid-1');
    expect(result).toBe('[[guid-1|Foo]] and again [[guid-1|Foo]] and [[guid-1|alias]].');
  });

  it('rewrites only the matching target among several distinct links', () => {
    const result = rewriteWikiLink('[[Foo]] and [[Bar]] and [[Foo|alias]].', 'Foo', 'guid-1');
    expect(result).toBe('[[guid-1|Foo]] and [[Bar]] and [[guid-1|alias]].');
  });

  it('matches case-insensitively', () => {
    const result = rewriteWikiLink('[[foo]] and [[FOO]].', 'Foo', 'guid-1');
    expect(result).toBe('[[guid-1|foo]] and [[guid-1|FOO]].');
  });

  it('matches with surrounding whitespace trimmed, per the parser rules', () => {
    const result = rewriteWikiLink('[[ Foo  ]]', 'Foo', 'guid-1');
    expect(result).toBe('[[guid-1|Foo]]');
  });

  it('trims a fromTarget with surrounding whitespace before matching', () => {
    const result = rewriteWikiLink('[[Foo]]', '  Foo  ', 'guid-1');
    expect(result).toBe('[[guid-1|Foo]]');
  });

  it('returns the markdown unchanged (by reference) when nothing matches', () => {
    const markdown = '[[Bar]] has no [[Foo]] here... wait, it does not match Baz.';
    const result = rewriteWikiLink('No wiki links at all here.', 'Baz', 'guid-1');
    expect(result).toBe('No wiki links at all here.');
    const noMatch = rewriteWikiLink(markdown, 'Zzz', 'guid-1');
    expect(noMatch).toBe(markdown);
  });

  it('rewrites a page-guid-typed target (already a guid string) the same way', () => {
    const result = rewriteWikiLink(
      'See [[550e8400-e29b-41d4-a716-446655440000|Home]] here.',
      '550e8400-e29b-41d4-a716-446655440000',
      'new-guid',
    );
    expect(result).toBe('See [[new-guid|Home]] here.');
  });
});
