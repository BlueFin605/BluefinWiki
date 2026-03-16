/**
 * Tests for MarkdownPreview component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '../MarkdownPreview';

describe('MarkdownPreview', () => {
  describe('Basic Markdown Rendering', () => {
    it('should render plain text', () => {
      render(<MarkdownPreview content="Hello World" />);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('should render headings', () => {
      const content = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByRole('heading', { level: 1, name: 'H1' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'H2' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'H3' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'H4' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 5, name: 'H5' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 6, name: 'H6' })).toBeInTheDocument();
    });

    it('should render bold text', () => {
      render(<MarkdownPreview content="**bold text**" />);
      const boldElement = screen.getByText('bold text');
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('should render italic text', () => {
      render(<MarkdownPreview content="*italic text*" />);
      const italicElement = screen.getByText('italic text');
      expect(italicElement.tagName).toBe('EM');
    });

    it('should render paragraphs', () => {
      const content = 'First paragraph\n\nSecond paragraph';
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('First paragraph')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph')).toBeInTheDocument();
    });
  });

  describe('GitHub Flavored Markdown', () => {
    it('should render strikethrough text', () => {
      render(<MarkdownPreview content="~~strikethrough~~" />);
      const strikeElement = screen.getByText('strikethrough');
      expect(strikeElement.tagName).toBe('DEL');
    });

    it('should render tables', () => {
      const content = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
      `;
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 2')).toBeInTheDocument();
    });

    it('should render task lists', () => {
      const content = `
- [ ] Unchecked task
- [x] Checked task
      `;
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('Unchecked task')).toBeInTheDocument();
      expect(screen.getByText('Checked task')).toBeInTheDocument();
      
      // Check for checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).toBeChecked();
    });

    it('should render autolinks', () => {
      render(<MarkdownPreview content="https://example.com" />);
      const link = screen.getByText('https://example.com');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('Lists', () => {
    it('should render unordered lists', () => {
      const content = `
- Item 1
- Item 2
- Item 3
      `;
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should render ordered lists', () => {
      const content = `
1. First
2. Second
3. Third
      `;
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('should render nested lists', () => {
      const content = `
- Parent 1
  - Child 1
  - Child 2
- Parent 2
      `;
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('Parent 1')).toBeInTheDocument();
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Parent 2')).toBeInTheDocument();
    });
  });

  describe('Code', () => {
    it('should render inline code', () => {
      render(<MarkdownPreview content="This is `inline code`" />);
      const codeElement = screen.getByText('inline code');
      expect(codeElement.tagName).toBe('CODE');
    });

    it('should render code blocks', () => {
      const content = '```\nconst x = 5;\nconsole.log(x);\n```';
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('const x = 5;', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('console.log(x)', { exact: false })).toBeInTheDocument();
    });

    it('should render code blocks with language', () => {
      const content = '```javascript\nconst x = 5;\n```';
      const { container } = render(<MarkdownPreview content={content} />);
      
      // Check for the text within the code block
      const codeBlock = container.querySelector('code');
      expect(codeBlock).toBeInTheDocument();
      expect(codeBlock?.textContent).toContain('const x = 5');
    });

    it('should render multi-line code blocks', () => {
      const content = `
\`\`\`
Line 1
Line 2
Line 3
\`\`\`
      `;
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('Line 1', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Line 2', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Line 3', { exact: false })).toBeInTheDocument();
    });
  });

  describe('Links', () => {
    it('should render external links that open in a new tab', () => {
      render(<MarkdownPreview content="[Link Text](https://example.com)" />);
      const link = screen.getByText('Link Text');

      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveClass('cursor-pointer');
    });

    it('should render multiple links', () => {
      const content = '[Link 1](url1) and [Link 2](url2)';
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('Link 1')).toBeInTheDocument();
      expect(screen.getByText('Link 2')).toBeInTheDocument();
    });
  });

  describe('Blockquotes', () => {
    it('should render blockquotes', () => {
      render(<MarkdownPreview content="> This is a quote" />);
      expect(screen.getByText('This is a quote')).toBeInTheDocument();
    });

    it('should render multi-line blockquotes', () => {
      const content = '> Line 1\n> Line 2';
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('Line 1', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Line 2', { exact: false })).toBeInTheDocument();
    });
  });

  describe('Horizontal Rules', () => {
    it('should render horizontal rules', () => {
      const { container } = render(<MarkdownPreview content="---" />);
      const hr = container.querySelector('hr');
      expect(hr).toBeInTheDocument();
    });
  });

  describe('Complex Markdown', () => {
    it('should render mixed formatting', () => {
      const content = '**Bold** and *italic* and ~~strikethrough~~ and `code`';
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('Bold')).toBeInTheDocument();
      expect(screen.getByText('italic')).toBeInTheDocument();
      expect(screen.getByText('strikethrough')).toBeInTheDocument();
      expect(screen.getByText('code')).toBeInTheDocument();
    });

    it('should render nested formatting', () => {
      const content = '**Bold with *italic* inside**';
      render(<MarkdownPreview content={content} />);
      
      expect(screen.getByText('italic')).toBeInTheDocument();
    });

    it('should render complete document', () => {
      const content = `
# Main Title

## Section 1

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2

\`\`\`javascript
const x = 5;
\`\`\`

## Section 2

> A quote

[A link](https://example.com)
      `;
      const { container } = render(<MarkdownPreview content={content} />);
      
      expect(screen.getByRole('heading', { level: 1, name: 'Main Title' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Section 1' })).toBeInTheDocument();
      expect(screen.getByText('bold')).toBeInTheDocument();
      expect(screen.getByText('italic')).toBeInTheDocument();
      expect(screen.getByText('List item 1')).toBeInTheDocument();
      
      // Check code block content
      const codeBlock = container.querySelector('code');
      expect(codeBlock?.textContent).toContain('const x = 5');
      
      expect(screen.getByText('A quote')).toBeInTheDocument();
      expect(screen.getByText('A link')).toBeInTheDocument();
    });
  });

  describe('Line Breaks', () => {
    it('should render line breaks with remark-breaks', () => {
      const content = 'Line 1\nLine 2';
      render(<MarkdownPreview content={content} />);
      
      // remark-breaks should convert single newlines to <br>
      expect(screen.getByText('Line 1', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Line 2', { exact: false })).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <MarkdownPreview content="# Test" className="custom-class" />
      );
      
      const wrapperDiv = container.firstChild;
      expect(wrapperDiv).toHaveClass('custom-class');
    });

    it('should apply markdown preview styling', () => {
      const { container } = render(<MarkdownPreview content="# Test" />);
      
      // Check that the markdown preview wrapper exists
      const wrapperDiv = container.firstChild;
      expect(wrapperDiv).toBeInTheDocument();
    });
  });

  describe('Empty Content', () => {
    it('should handle empty string', () => {
      const { container } = render(<MarkdownPreview content="" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should handle whitespace only', () => {
      const { container } = render(<MarkdownPreview content="   \n  \n  " />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Special Characters', () => {
    it('should render HTML entities correctly', () => {
      render(<MarkdownPreview content="&lt;div&gt;escaped&lt;/div&gt;" />);
      expect(screen.getByText('<div>escaped</div>', { exact: false })).toBeInTheDocument();
    });

    it('should handle special markdown characters', () => {
      const { container } = render(<MarkdownPreview content="Asterisk: \\* Underscore: \\_ Backtick: \\`" />);
      
      // The escaped characters should be rendered with backslash (markdown preserves escaping)
      expect(container.textContent).toContain('Asterisk: \\*');
      expect(container.textContent).toContain('Underscore: \\_');
      expect(container.textContent).toContain('Backtick: \\`');
    });
  });

  describe('Images', () => {
    it('should render image syntax', () => {
      const { container } = render(
        <MarkdownPreview content="![Alt text](https://example.com/image.png)" />
      );
      
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', 'Alt text');
      expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    });

    it('should render image with title', () => {
      const { container } = render(
        <MarkdownPreview content='![Alt](https://example.com/img.png "Title")' />
      );
      
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('title', 'Title');
    });
  });
});
