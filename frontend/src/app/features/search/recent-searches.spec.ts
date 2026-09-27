import {
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  addRecent,
  readRecentSearches,
  removeRecent,
  writeRecentSearches,
} from './recent-searches';

describe('addRecent / removeRecent (pure list ops)', () => {
  it('prepends a new term (most-recent-first)', () => {
    expect(addRecent(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('dedupes: re-adding an existing term moves it to the front instead of duplicating it', () => {
    expect(addRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('caps the list at MAX_RECENT_SEARCHES, dropping the oldest', () => {
    const full = Array.from({ length: MAX_RECENT_SEARCHES }, (_, i) => `term-${i}`);
    const result = addRecent(full, 'new-term');
    expect(result).toHaveLength(MAX_RECENT_SEARCHES);
    expect(result[0]).toBe('new-term');
    expect(result).not.toContain(`term-${MAX_RECENT_SEARCHES - 1}`);
  });

  it('trims whitespace before storing', () => {
    expect(addRecent([], '  hello  ')).toEqual(['hello']);
  });

  it('is a no-op for a blank/whitespace-only term', () => {
    expect(addRecent(['a'], '   ')).toEqual(['a']);
    expect(addRecent(['a'], '')).toEqual(['a']);
  });

  it('does not mutate the input list', () => {
    const original = ['a', 'b'];
    addRecent(original, 'c');
    expect(original).toEqual(['a', 'b']);
  });

  it('removeRecent drops exactly the matching term and leaves the rest/order intact', () => {
    expect(removeRecent(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('removeRecent is a no-op when the term is absent', () => {
    expect(removeRecent(['a', 'b'], 'missing')).toEqual(['a', 'b']);
  });

  it('removeRecent does not mutate the input list', () => {
    const original = ['a', 'b'];
    removeRecent(original, 'a');
    expect(original).toEqual(['a', 'b']);
  });
});

describe('readRecentSearches / writeRecentSearches (storage)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty list when nothing is stored', () => {
    expect(readRecentSearches()).toEqual([]);
  });

  it('round-trips a list through localStorage', () => {
    writeRecentSearches(['a', 'b']);
    expect(readRecentSearches()).toEqual(['a', 'b']);
  });

  it('writes under the documented storage key', () => {
    writeRecentSearches(['a']);
    expect(JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? 'null')).toEqual(['a']);
  });

  it('survives malformed stored JSON without throwing', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, '{not json');
    expect(() => readRecentSearches()).not.toThrow();
    expect(readRecentSearches()).toEqual([]);
  });

  it('survives a stored value that is not an array without throwing', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify({ not: 'an array' }));
    expect(readRecentSearches()).toEqual([]);
  });

  it('filters out non-string entries from a malformed stored array', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['a', 42, null, 'b']));
    expect(readRecentSearches()).toEqual(['a', 'b']);
  });

  it('swallows a getItem failure and returns an empty list', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => readRecentSearches()).not.toThrow();
    expect(readRecentSearches()).toEqual([]);
    spy.mockRestore();
  });

  it('swallows a setItem failure without throwing', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writeRecentSearches(['a'])).not.toThrow();
    spy.mockRestore();
  });
});
