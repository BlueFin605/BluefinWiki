import { describe, it, expect } from 'vitest';
import {
  parseWikiLinks,
  isGuid,
  isValidWikiLink,
  getDisplayText,
  hasExternalUrl,
  type WikiLink,
} from '../wikiLinkParser';

describe('wikiLinkParser', () => {
  describe('parseWikiLinks', () => {
    it('should parse basic wiki link with page title', () => {
      const markdown = 'Check out [[Getting Started]] for more info.';
      const links = parseWikiLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        type: 'page-title',
        raw: '[[Getting Started]]',
        target: 'Getting Started',
        startIndex: 10,
        endIndex: 29,
      });
    });

    it('should parse wiki link with GUID and display text', () => {
      const markdown = 'See [[550e8400-e29b-41d4-a716-446655440000|Home Page]] here.';
      const links = parseWikiLinks(markdown);

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

    it('should parse multiple wiki links in text', () => {
      const markdown = '[[Page One]] and [[Page Two]] are linked.';
      const links = parseWikiLinks(markdown);

      expect(links).toHaveLength(2);
      expect(links[0].target).toBe('Page One');
      expect(links[1].target).toBe('Page Two');
    });

    it('should handle wiki links at start and end of text', () => {
      const markdown = '[[Start]] middle [[End]]';
      const links = parseWikiLinks(markdown);

      expect(links).toHaveLength(2);
      expect(links[0].target).toBe('Start');
      expect(links[0].startIndex).toBe(0);
      expect(links[1].target).toBe('End');
      expect(links[1].endIndex).toBe(24);
    });

    it('should handle empty content gracefully', () => {
      const markdown = '';
      const links = parseWikiLinks(markdown);

      expect(links).toHaveLength(0);
    });

    it('should handle text with no wiki links', () => {
      const markdown = 'This is just regular text with [normal links](url)';
      const links = parseWikiLinks(markdown);

      expect(links).toHaveLength(0);
    });

    it('should trim whitespace from link content', () => {
      const markdown = '[[ Page Title  ]] and [[  guid  | Display  ]]';
      const links = parseWikiLinks(markdown);

      expect(links).toHaveLength(2);
      expect(links[0].target).toBe('Page Title');
      expect(links[1].target).toBe('guid');
      expect(links[1].displayText).toBe('Display');
    });

    it('should handle special characters in page titles', () => {
      const markdown = '[[Page: Title & Subtopic (2024)]]';
      const links = parseWikiLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('Page: Title & Subtopic (2024)');
    });
  });

  describe('isGuid', () => {
    it('should recognize valid GUIDs', () => {
      expect(isGuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isGuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isGuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('should recognize valid GUIDs regardless of case', () => {
      expect(isGuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(isGuid('550e8400-E29b-41D4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid GUIDs', () => {
      expect(isGuid('not-a-guid')).toBe(false);
      expect(isGuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isGuid('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
      expect(isGuid('')).toBe(false);
      expect(isGuid('Page Title')).toBe(false);
    });
  });

  describe('isValidWikiLink', () => {
    it('should validate page title format', () => {
      expect(isValidWikiLink('Page Title')).toBe(true);
      expect(isValidWikiLink('Getting Started')).toBe(true);
    });

    it('should validate GUID with display text format', () => {
      expect(isValidWikiLink('550e8400-e29b-41d4-a716-446655440000|Display Text')).toBe(true);
    });

    it('should reject empty or whitespace-only links', () => {
      expect(isValidWikiLink('')).toBe(false);
      expect(isValidWikiLink('   ')).toBe(false);
    });

    it('should reject links with empty parts', () => {
      expect(isValidWikiLink('|Display Text')).toBe(false);
      expect(isValidWikiLink('550e8400-e29b-41d4-a716-446655440000|')).toBe(false);
      expect(isValidWikiLink(' | ')).toBe(false);
    });

    it('should reject invalid GUID in pipe format', () => {
      expect(isValidWikiLink('not-a-guid|Display Text')).toBe(false);
      expect(isValidWikiLink('Page Title|Display Text')).toBe(false);
    });
  });

  describe('getDisplayText', () => {
    it('should return display text when provided', () => {
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

    it('should return target when no display text provided', () => {
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
    it('should detect HTTP URLs', () => {
      expect(hasExternalUrl('http://example.com')).toBe(true);
      expect(hasExternalUrl('HTTP://EXAMPLE.COM')).toBe(true);
    });

    it('should detect HTTPS URLs', () => {
      expect(hasExternalUrl('https://example.com')).toBe(true);
      expect(hasExternalUrl('HTTPS://EXAMPLE.COM')).toBe(true);
    });

    it('should detect FTP URLs', () => {
      expect(hasExternalUrl('ftp://files.example.com')).toBe(true);
    });

    it('should detect mailto links', () => {
      expect(hasExternalUrl('mailto:user@example.com')).toBe(true);
    });

    it('should not detect internal links', () => {
      expect(hasExternalUrl('/wiki/page')).toBe(false);
      expect(hasExternalUrl('Page Title')).toBe(false);
      expect(hasExternalUrl('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('should not detect partial matches', () => {
      expect(hasExternalUrl('not http://url')).toBe(false);
      expect(hasExternalUrl('see https://example later')).toBe(false);
    });
  });
});
