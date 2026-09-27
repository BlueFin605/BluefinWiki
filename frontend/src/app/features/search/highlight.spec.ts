import { highlight } from './highlight';

describe('highlight', () => {
  it('marks a single case-insensitive match', () => {
    expect(highlight('Hello World', 'world')).toEqual([
      { text: 'Hello ', match: false },
      { text: 'World', match: true },
    ]);
  });

  it('marks multiple occurrences of the query', () => {
    expect(highlight('cat sat on the cat mat', 'cat')).toEqual([
      { text: 'cat', match: true },
      { text: ' sat on the ', match: false },
      { text: 'cat', match: true },
      { text: ' mat', match: false },
    ]);
  });

  it('returns a single unmarked segment when there is no match', () => {
    expect(highlight('Hello World', 'xyz')).toEqual([{ text: 'Hello World', match: false }]);
  });

  it('returns a single unmarked segment for an empty query', () => {
    expect(highlight('Hello World', '')).toEqual([{ text: 'Hello World', match: false }]);
  });

  it('returns a single unmarked segment for a whitespace-only query', () => {
    expect(highlight('Hello World', '   ')).toEqual([{ text: 'Hello World', match: false }]);
  });

  it('handles regex-special characters in the query literally', () => {
    expect(highlight('a (b) c', '(b)')).toEqual([
      { text: 'a ', match: false },
      { text: '(b)', match: true },
      { text: ' c', match: false },
    ]);
    // A query with unmatched/greedy regex metacharacters must not throw or
    // behave like a regex — it's treated as a literal string to find.
    expect(() => highlight('cost: $5.00 (was $10.00)', '$5.00')).not.toThrow();
    expect(highlight('cost: $5.00 (was $10.00)', '$5.00')).toEqual([
      { text: 'cost: ', match: false },
      { text: '$5.00', match: true },
      { text: ' (was $10.00)', match: false },
    ]);
  });

  it('preserves HTML-special characters in the source text as plain text (no execution/parsing)', () => {
    const segments = highlight('<script>alert(1)</script> world', 'world');
    // The helper never parses/escapes HTML itself — it only splits the raw
    // string into segments; the template's interpolation binding is what
    // keeps this safe when rendered (never innerHTML).
    expect(segments).toEqual([
      { text: '<script>alert(1)</script> ', match: false },
      { text: 'world', match: true },
    ]);
  });

  it('matches at the very start and end of the text', () => {
    expect(highlight('World Hello World', 'world')).toEqual([
      { text: 'World', match: true },
      { text: ' Hello ', match: false },
      { text: 'World', match: true },
    ]);
  });

  it('returns a single unmarked segment for empty source text', () => {
    expect(highlight('', 'world')).toEqual([{ text: '', match: false }]);
  });
});
