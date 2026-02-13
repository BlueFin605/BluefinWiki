import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '../MarkdownPreview';

describe('MarkdownPreview - Wiki Links', () => {
  it('should render basic wiki link with page title', () => {
    const content = 'Check out [[Getting Started]] for more info.';
    render(<MarkdownPreview content={content} />);

    // Check that the link is rendered
    const link = screen.getByText('Getting Started');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/wiki/getting-started');
  });

  it('should render wiki link with GUID and display text', () => {
    const content = 'See [[550e8400-e29b-41d4-a716-446655440000|Home Page]] here.';
    render(<MarkdownPreview content={content} />);

    // Check that the custom display text is shown
    const link = screen.getByText('Home Page');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/wiki/550e8400-e29b-41d4-a716-446655440000');
  });

  it('should render multiple wiki links', () => {
    const content = 'Links: [[Page One]] and [[Page Two]]';
    render(<MarkdownPreview content={content} />);

    const link1 = screen.getByText('Page One');
    const link2 = screen.getByText('Page Two');

    expect(link1).toBeInTheDocument();
    expect(link2).toBeInTheDocument();
    expect(link1).toHaveAttribute('href', '/wiki/page-one');
    expect(link2).toHaveAttribute('href', '/wiki/page-two');
  });

  it('should apply wiki-link class to wiki links', () => {
    const content = 'Check [[Page Title]] out';
    render(<MarkdownPreview content={content} />);

    const link = screen.getByText('Page Title');
    expect(link).toHaveAttribute('data-wiki-link', 'true');
  });

  it('should render external links separately from wiki links', () => {
    const content = 'Wiki: [[Internal Page]] and External: [External](https://example.com)';
    render(<MarkdownPreview content={content} />);

    const wikiLink = screen.getByText('Internal Page');
    const externalLink = screen.getByText('External');

    expect(wikiLink).toHaveAttribute('data-wiki-link', 'true');
    expect(externalLink).not.toHaveAttribute('data-wiki-link');
    expect(externalLink).toHaveAttribute('href', 'https://example.com');
  });

  it('should render content without wiki links normally', () => {
    const content = 'Just regular text with no wiki links.';
    render(<MarkdownPreview content={content} />);

    expect(screen.getByText(/Just regular text/)).toBeInTheDocument();
  });

  it('should handle mixed content with wiki links and markdown', () => {
    const content = '# Title\n\nSome **bold** text and [[Wiki Link]].\n\n- List item';
    render(<MarkdownPreview content={content} />);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('Wiki Link')).toBeInTheDocument();
    expect(screen.getByText(/List item/)).toBeInTheDocument();
  });
});
