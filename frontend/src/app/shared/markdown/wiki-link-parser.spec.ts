import {
  parseWikiLinks,
  isGuid,
  isValidWikiLink,
  getDisplayText,
  hasExternalUrl,
  type WikiLink,
} from './wiki-link-parser';

describe('wikiLinkParser', () => {
  describe('parseWikiLinks', () => {
    it('parses basic wiki link with page title', () => {
      const links = parseWikiLinks('Check out [[Getting Started]] for more info.');
      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        type: 'page-title',
        raw: '[[Getting Started]]',
        target: 'Getting Started',
        startIndex: 10,
        endIndex: 29,
      });
    });

    it('parses wiki link with GUID and display text', () => {
      const links = parseWikiLinks('See [[550e8400-e29b-41d4-a716-446655440000|Home Page]] here.');
      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        type: 'page-guid',
        raw: '[[550e8400-e29b-41d4-a716-446655440000|Home Page]]',
        target: '550e8400-e29b-41d4-a716-446655440000',
        displayText: 'Home Page',
        startIndex: 4,
        endIndex: 54,
      });
    });

    it('parses multiple wiki links in text', () => {
      const links = parseWikiLinks('[[Page One]] and [[Page Two]] are linked.');
      expect(links).toHaveLength(2);
      expect(links[0].target).toBe('Page One');
      expect(links[1].target).toBe('Page Two');
    });

    it('handles links at start and end of text', () => {
      const links = parseWikiLinks('[[Start]] middle [[End]]');
      expect(links).toHaveLength(2);
      expect(links[0].startIndex).toBe(0);
      expect(links[1].endIndex).toBe(24);
    });

    it('handles empty content', () => {
      expect(parseWikiLinks('')).toHaveLength(0);
    });

    it('returns empty array when no wiki links present', () => {
      expect(parseWikiLinks('Plain text with [normal](url) link only.')).toHaveLength(0);
    });

    it('trims whitespace inside link content', () => {
      const links = parseWikiLinks('[[ Page Title  ]] and [[  guid  | Display  ]]');
      expect(links[0].target).toBe('Page Title');
      expect(links[1].target).toBe('guid');
      expect(links[1].displayText).toBe('Display');
    });

    it('handles special characters in page titles', () => {
      const links = parseWikiLinks('[[Page: Title & Subtopic (2024)]]');
      expect(links[0].target).toBe('Page: Title & Subtopic (2024)');
    });
  });

  describe('isGuid', () => {
    it('accepts valid GUIDs', () => {
      expect(isGuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isGuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isGuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('accepts GUIDs case-insensitively', () => {
      expect(isGuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(isGuid('550e8400-E29b-41D4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid GUIDs', () => {
      expect(isGuid('not-a-guid')).toBe(false);
      expect(isGuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isGuid('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
      expect(isGuid('')).toBe(false);
      expect(isGuid('Page Title')).toBe(false);
    });
  });

  describe('isValidWikiLink', () => {
    it('validates page-title format', () => {
      expect(isValidWikiLink('Page Title')).toBe(true);
      expect(isValidWikiLink('Getting Started')).toBe(true);
    });

    it('validates GUID-with-display format', () => {
      expect(isValidWikiLink('550e8400-e29b-41d4-a716-446655440000|Display Text')).toBe(true);
    });

    it('rejects empty or whitespace-only links', () => {
      expect(isValidWikiLink('')).toBe(false);
      expect(isValidWikiLink('   ')).toBe(false);
    });

    it('rejects links with empty parts around the pipe', () => {
      expect(isValidWikiLink('|Display Text')).toBe(false);
      expect(isValidWikiLink('550e8400-e29b-41d4-a716-446655440000|')).toBe(false);
      expect(isValidWikiLink(' | ')).toBe(false);
    });

    it('rejects non-GUID target in pipe format', () => {
      expect(isValidWikiLink('not-a-guid|Display Text')).toBe(false);
      expect(isValidWikiLink('Page Title|Display Text')).toBe(false);
    });
  });

  describe('getDisplayText', () => {
    it('returns displayText when present', () => {
      const link: WikiLink = {
        type: 'page-guid',
        raw: '[[guid|Custom Text]]',
        target: '550e8400-e29b-41d4-a716-446655440000',
        displayText: 'Custom Text',
        startIndex: 0,
        endIndex: 20,
      };
      expect(getDisplayText(link)).toBe('Custom Text');
    });

    it('returns target when displayText absent', () => {
      const link: WikiLink = {
        type: 'page-title',
        raw: '[[Page Title]]',
        target: 'Page Title',
        startIndex: 0,
        endIndex: 14,
      };
      expect(getDisplayText(link)).toBe('Page Title');
    });
  });

  describe('hasExternalUrl', () => {
    it('detects HTTP and HTTPS', () => {
      expect(hasExternalUrl('http://example.com')).toBe(true);
      expect(hasExternalUrl('HTTPS://EXAMPLE.COM')).toBe(true);
    });

    it('detects FTP and mailto', () => {
      expect(hasExternalUrl('ftp://files.example.com')).toBe(true);
      expect(hasExternalUrl('mailto:user@example.com')).toBe(true);
    });

    it('does not match partial occurrences in mid-text', () => {
      expect(hasExternalUrl('not http://url')).toBe(false);
      expect(hasExternalUrl('see https://example later')).toBe(false);
    });

    it('does not match internal paths', () => {
      expect(hasExternalUrl('/wiki/page')).toBe(false);
      expect(hasExternalUrl('Page Title')).toBe(false);
    });
  });
});
