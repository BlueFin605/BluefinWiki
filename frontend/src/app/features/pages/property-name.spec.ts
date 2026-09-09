import { kebabCasePropertyName, validatePropertyName } from './property-name';

describe('kebabCasePropertyName', () => {
  it('lower-cases and hyphenates whitespace', () => {
    expect(kebabCasePropertyName('Release Year')).toBe('release-year');
  });

  it('drops punctuation and collapses repeated / edge hyphens', () => {
    expect(kebabCasePropertyName('  --Release__Year!!  ')).toBe('releaseyear');
    expect(kebabCasePropertyName('a  b')).toBe('a-b');
    expect(kebabCasePropertyName('-x-')).toBe('x');
  });

  it('is a no-op for an already-kebab name', () => {
    expect(kebabCasePropertyName('release-year')).toBe('release-year');
  });
});

describe('validatePropertyName', () => {
  it('accepts a non-empty, unique, already-kebab name', () => {
    const r = validatePropertyName('release-year', ['author', 'status']);
    expect(r).toEqual({ ok: true, name: 'release-year', error: null });
  });

  it('rejects a blank name with a message', () => {
    const r = validatePropertyName('   ', []);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/enter/i);
  });

  it('rejects a name that is not already kebab-case', () => {
    const r = validatePropertyName('Release Year', []);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/kebab/i);
    // The suggested kebab form is still reported for convenience.
    expect(r.name).toBe('release-year');
  });

  it('rejects a duplicate of an existing key (case where kebab form collides)', () => {
    const r = validatePropertyName('author', ['author', 'status']);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/exists/i);
  });

  it('accepts a Set of existing keys, not just an array', () => {
    const r = validatePropertyName('genre', new Set(['author']));
    expect(r.ok).toBe(true);
  });
});
