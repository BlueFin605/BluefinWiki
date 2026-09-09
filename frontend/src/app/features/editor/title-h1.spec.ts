import { firstLineIsH1, rewriteFirstH1, firstH1Range } from './title-h1';

describe('title-h1 helpers', () => {
  describe('firstLineIsH1', () => {
    it('is true when the first non-empty line is an H1', () => {
      expect(firstLineIsH1('# Hello\n\nx')).toBe(true);
    });

    it('is false for plain text', () => {
      expect(firstLineIsH1('Hello')).toBe(false);
    });

    it('skips leading blank lines to find the first content line', () => {
      expect(firstLineIsH1('\n\n   \n# Later\ntext')).toBe(true);
      expect(firstLineIsH1('\n\nplain\n# Later')).toBe(false);
    });

    it('is false for an empty buffer', () => {
      expect(firstLineIsH1('')).toBe(false);
      expect(firstLineIsH1('   \n\n')).toBe(false);
    });

    it('requires a single # followed by whitespace', () => {
      expect(firstLineIsH1('## Sub heading')).toBe(false);
      expect(firstLineIsH1('#NoSpace')).toBe(false);
    });
  });

  describe('rewriteFirstH1', () => {
    it('replaces only the first H1 line', () => {
      expect(rewriteFirstH1('# Old\n\nx', 'New')).toBe('# New\n\nx');
    });

    it('leaves a non-H1 first line (and the rest of the buffer) alone', () => {
      expect(rewriteFirstH1('Plain\n# Later\nx', 'New')).toBe('Plain\n# Later\nx');
    });

    it('rewrites the first content line even behind leading blank lines', () => {
      expect(rewriteFirstH1('\n# Old\nbody', 'New')).toBe('\n# New\nbody');
    });

    it('trims the incoming title', () => {
      expect(rewriteFirstH1('# Old\nx', '  Trimmed  ')).toBe('# Trimmed\nx');
    });

    it('returns the identical string reference when nothing changes (loop guard)', () => {
      const md = '# Same\n\nbody';
      expect(rewriteFirstH1(md, 'Same')).toBe(md);
      const plain = 'no heading here';
      expect(rewriteFirstH1(plain, 'New')).toBe(plain);
    });

    it('is idempotent', () => {
      const once = rewriteFirstH1('# Old\n\nx', 'New');
      expect(rewriteFirstH1(once, 'New')).toBe(once);
    });
  });

  describe('firstH1Range', () => {
    it('spans the first line when it is an H1', () => {
      expect(firstH1Range('# Old\n\nx')).toEqual({ from: 0, to: 5 });
    });

    it('accounts for leading blank lines', () => {
      expect(firstH1Range('\n# Old\nx')).toEqual({ from: 1, to: 6 });
    });

    it('is null when the first content line is not an H1', () => {
      expect(firstH1Range('plain\n# Later')).toBeNull();
      expect(firstH1Range('')).toBeNull();
    });

    it('locates the H1 line text exactly', () => {
      const md = 'first\n\n# The Heading\nmore';
      const range = firstH1Range(md.replace('first', '# first'));
      // The replaced buffer starts with an H1 on line 1.
      expect(range).toEqual({ from: 0, to: 7 });
      expect('# first\n\n# The Heading\nmore'.slice(range!.from, range!.to)).toBe('# first');
    });
  });
});
