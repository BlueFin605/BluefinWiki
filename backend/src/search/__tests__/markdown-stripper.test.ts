/**
 * Unit Tests for Markdown Stripper
 * Task 8.2: Strip markdown formatting from content for search indexing
 */

import { describe, it, expect } from 'vitest';
import { stripMarkdown } from '../markdown-stripper.js';

describe('stripMarkdown', () => {
  it('should return empty string for empty input', () => {
    expect(stripMarkdown('')).toBe('');
  });

  it('should return empty string for null/undefined input', () => {
    expect(stripMarkdown(null as unknown as string)).toBe('');
    expect(stripMarkdown(undefined as unknown as string)).toBe('');
  });

  it('should pass through plain text unchanged', () => {
    expect(stripMarkdown('Hello world')).toBe('Hello world');
  });

  describe('headers', () => {
    it('should strip h1 headers', () => {
      expect(stripMarkdown('# My Title')).toBe('My Title');
    });

    it('should strip h2-h6 headers', () => {
      expect(stripMarkdown('## Sub Title')).toBe('Sub Title');
      expect(stripMarkdown('### H3')).toBe('H3');
      expect(stripMarkdown('###### H6')).toBe('H6');
    });

    it('should strip headers in multiline content', () => {
      const input = '# Title\n\nSome text\n\n## Section';
      const result = stripMarkdown(input);
      expect(result).toContain('Title');
      expect(result).toContain('Some text');
      expect(result).toContain('Section');
      expect(result).not.toContain('#');
    });
  });

  describe('emphasis', () => {
    it('should strip bold markers (**)', () => {
      expect(stripMarkdown('This is **bold** text')).toBe('This is bold text');
    });

    it('should strip italic markers (*)', () => {
      expect(stripMarkdown('This is *italic* text')).toBe('This is italic text');
    });

    it('should strip bold italic markers (***)', () => {
      expect(stripMarkdown('This is ***bold italic*** text')).toBe('This is bold italic text');
    });

    it('should strip underscore emphasis', () => {
      expect(stripMarkdown('This is __bold__ text')).toBe('This is bold text');
      expect(stripMarkdown('This is _italic_ text')).toBe('This is italic text');
    });

    it('should strip strikethrough', () => {
      expect(stripMarkdown('This is ~~deleted~~ text')).toBe('This is deleted text');
    });
  });

  describe('code', () => {
    it('should strip inline code backticks', () => {
      expect(stripMarkdown('Use `console.log()` here')).toBe('Use console.log() here');
    });

    it('should remove fenced code blocks entirely', () => {
      const input = 'Before\n\n```javascript\nconst x = 1;\n```\n\nAfter';
      const result = stripMarkdown(input);
      expect(result).toContain('Before');
      expect(result).toContain('After');
      expect(result).not.toContain('const x');
    });

    it('should remove mermaid code blocks entirely', () => {
      const input = 'Before\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nAfter';
      const result = stripMarkdown(input);
      expect(result).toContain('Before');
      expect(result).toContain('After');
      expect(result).not.toContain('graph');
      expect(result).not.toContain('mermaid');
    });
  });

  describe('links', () => {
    it('should strip links but keep link text', () => {
      expect(stripMarkdown('Click [here](https://example.com) for more')).toBe(
        'Click here for more'
      );
    });

    it('should strip images but keep alt text', () => {
      expect(stripMarkdown('See ![my photo](image.jpg) above')).toBe('See my photo above');
    });

    it('should strip wiki links [[target]]', () => {
      expect(stripMarkdown('See [[Getting Started]] page')).toBe('See Getting Started page');
    });

    it('should strip wiki links with display text [[target|display]]', () => {
      expect(stripMarkdown('See [[page-guid|My Page]] here')).toBe('See My Page here');
    });
  });

  describe('block elements', () => {
    it('should strip blockquote markers', () => {
      expect(stripMarkdown('> This is a quote')).toBe('This is a quote');
    });

    it('should strip horizontal rules', () => {
      const input = 'Above\n\n---\n\nBelow';
      const result = stripMarkdown(input);
      expect(result).toContain('Above');
      expect(result).toContain('Below');
    });

    it('should strip unordered list markers', () => {
      const input = '- Item 1\n- Item 2\n- Item 3';
      const result = stripMarkdown(input);
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
      expect(result).not.toMatch(/^-/m);
    });

    it('should strip ordered list markers', () => {
      const input = '1. First\n2. Second\n3. Third';
      const result = stripMarkdown(input);
      expect(result).toContain('First');
      expect(result).toContain('Second');
      expect(result).not.toMatch(/^\d+\./m);
    });
  });

  describe('HTML', () => {
    it('should strip HTML tags', () => {
      expect(stripMarkdown('Text with <em>HTML</em> tags')).toBe('Text with HTML tags');
    });

    it('should strip self-closing tags', () => {
      expect(stripMarkdown('Line<br/>break')).toBe('Linebreak');
    });
  });

  describe('tables', () => {
    it('should strip table formatting', () => {
      const input = '| Name | Age |\n|------|-----|\n| Alice | 30 |';
      const result = stripMarkdown(input);
      expect(result).toContain('Name');
      expect(result).toContain('Age');
      expect(result).toContain('Alice');
      expect(result).not.toContain('|');
    });
  });

  describe('whitespace normalization', () => {
    it('should collapse multiple newlines', () => {
      const input = 'Para 1\n\n\n\n\nPara 2';
      const result = stripMarkdown(input);
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('should collapse multiple spaces', () => {
      const input = 'Too    many    spaces';
      expect(stripMarkdown(input)).toBe('Too many spaces');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(stripMarkdown('  hello  ')).toBe('hello');
    });
  });

  describe('real-world content', () => {
    it('should handle a typical wiki page', () => {
      const input = `# Family Vacation 2025

We went to **Italy** for our summer vacation.

## Highlights

- Visited the _Colosseum_ in Rome
- Ate amazing ~~pizza~~ pasta in Florence
- Took a boat ride in Venice

> "The world is a book, and those who do not travel read only one page."

See [[Recipes|Italian Recipes]] for food ideas.

\`\`\`
Some code block
\`\`\`

![Family Photo](vacation.jpg)

For more info, visit [our blog](https://example.com).`;

      const result = stripMarkdown(input);

      // Should contain key content
      expect(result).toContain('Family Vacation 2025');
      expect(result).toContain('Italy');
      expect(result).toContain('Colosseum');
      expect(result).toContain('Italian Recipes');

      // Should NOT contain markdown syntax
      expect(result).not.toContain('#');
      expect(result).not.toContain('**');
      expect(result).not.toContain('_Colosseum_');
      expect(result).not.toContain('~~');
      expect(result).not.toContain('```');
      expect(result).not.toContain('[[');
      expect(result).not.toContain('](');
      expect(result).not.toContain('![');
    });
  });
});
