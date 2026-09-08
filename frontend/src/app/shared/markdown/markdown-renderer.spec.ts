import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarkdownRenderer } from './markdown-renderer';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

async function renderMd(markdown: string): Promise<HTMLElement> {
  const result = await render(MarkdownRenderer, {
    inputs: { markdown },
    providers: [provideRouter([{ path: '**', redirectTo: '' }])],
  });
  return result.fixture.nativeElement as HTMLElement;
}

describe('MarkdownRenderer', () => {
  it('renders a paragraph', async () => {
    const el = await renderMd('Hello world.');
    expect(el.querySelector('p')?.textContent).toBe('Hello world.');
  });

  it('renders headings with slug ids', async () => {
    const el = await renderMd('# Hello World\n\n## Sub Section');
    const h1 = el.querySelector('h1');
    const h2 = el.querySelector('h2');
    expect(h1?.id).toBe('hello-world');
    expect(h2?.id).toBe('sub-section');
  });

  it('renders bullet lists', async () => {
    const el = await renderMd('- one\n- two\n- three');
    const items = el.querySelectorAll('ul li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent?.trim()).toBe('one');
  });

  it('renders GFM tables (proves remark-gfm reachable)', async () => {
    const el = await renderMd('| h |\n|---|\n| c |');
    expect(el.querySelector('table th')?.textContent?.trim()).toBe('h');
    expect(el.querySelector('table td')?.textContent?.trim()).toBe('c');
  });

  it('renders inline code', async () => {
    const el = await renderMd('Use `x` here.');
    expect(el.querySelector('code')?.textContent).toBe('x');
  });

  it('renders fenced code with the hljs class (proves rehype-highlight reachable)', async () => {
    const el = await renderMd('```ts\nconst x = 1;\n```');
    const code = el.querySelector('pre code');
    expect(code?.className).toMatch(/hljs/);
  });

  it('routes [[Title]] through <wiki-link>', async () => {
    const el = await renderMd('See [[Home Page]] now.');
    expect(el.querySelector('wiki-link')).not.toBeNull();
    expect(el.querySelector('wiki-link a.wiki-link')).not.toBeNull();
  });

  it('routes mermaid code blocks through <wiki-mermaid>', async () => {
    const el = await renderMd('```mermaid\nflowchart TD; A-->B\n```');
    expect(el.querySelector('wiki-mermaid')).not.toBeNull();
    expect(el.querySelector('pre code.language-mermaid')).toBeNull();
  });

  it('renders <img> with width attribute from remark-image-size', async () => {
    const el = await renderMd('![alt|200](pic.png)');
    const img = el.querySelector('img');
    expect(img?.getAttribute('width')).toBe('200px');
    expect(img?.getAttribute('alt')).toBe('alt');
  });

  it('renders <img> with both width and height from remark-image-size WxH syntax', async () => {
    const el = await renderMd('![alt|300x200](x.png)');
    const img = el.querySelector('img');
    expect(img?.getAttribute('width')).toBe('300px');
    expect(img?.getAttribute('height')).toBe('200px');
    expect(img?.getAttribute('alt')).toBe('alt');
  });

  it('renders task list checkboxes', async () => {
    const el = await renderMd('- [x] done\n- [ ] todo');
    const inputs = el.querySelectorAll('input[type="checkbox"]');
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).checked).toBe(true);
    expect((inputs[1] as HTMLInputElement).checked).toBe(false);
  });

  it('rewrites bare image URLs to the attachments endpoint when pageGuid is set', async () => {
    const { fixture } = await render(MarkdownRenderer, {
      inputs: { markdown: '![pic](pic.png)', pageGuid: 'g1' },
      providers: [
        provideRouter([{ path: '**', redirectTo: '' }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    const req = http.expectOne('/api/pages/g1/attachments/pic.png');
    req.flush({ url: 'https://s3.example.com/signed/pic.png' });
    await settle();
    fixture.detectChanges();

    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://s3.example.com/signed/pic.png');
    http.verify();
  });

  it('leaves relative image URLs alone when pageGuid is omitted (no crash)', async () => {
    const el = await renderMd('![pic](pic.png)');
    const img = el.querySelector('img');
    expect(img?.getAttribute('src')).toBe('pic.png');
  });

  // ---- Step 3.8: link post-processing (hash / external) -------------------

  it('renders in-page #anchor links without target=_blank and smooth-scrolls on click', async () => {
    const el = await renderMd('# Intro Section\n\nJump to [the intro](#intro-section).');
    const link = Array.from(el.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '#intro-section',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('target')).toBeNull();

    // jsdom does not implement scrollIntoView — install a spy so the hook can
    // call it.
    const heading = el.querySelector('#intro-section') as HTMLElement;
    const scrollSpy = jest.fn();
    heading.scrollIntoView = scrollSpy;

    link.click();

    expect(scrollSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
    expect(window.location.hash).toBe('#intro-section');
  });

  it('keeps target=_blank rel=noopener on external links', async () => {
    const el = await renderMd('Visit [the site](https://x.com) today.');
    const link = el.querySelector('a[href="https://x.com"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('routes [[Title]] to /pages/<guid> when a resolveWikiTarget is supplied', async () => {
    const { fixture } = await render(MarkdownRenderer, {
      inputs: {
        markdown: 'See [[Some Page]].',
        resolveWikiTarget: () => ({ guid: 'guid-abc', exists: true }),
      },
      providers: [provideRouter([{ path: '**', redirectTo: '' }])],
    });
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'wiki-link a.wiki-link',
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/pages/guid-abc');
  });

  it('renders the broken state for a [[Title]] the resolver reports missing', async () => {
    const { fixture } = await render(MarkdownRenderer, {
      inputs: {
        markdown: 'See [[Gone]].',
        resolveWikiTarget: () => ({ guid: 'gone', exists: false }),
      },
      providers: [provideRouter([{ path: '**', redirectTo: '' }])],
    });
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'wiki-link a.wiki-link-broken',
    );
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('?');
  });

  it('updates rendered output when the markdown input changes', async () => {
    const { fixture } = await render(MarkdownRenderer, {
      inputs: { markdown: '# First' },
      providers: [provideRouter([{ path: '**', redirectTo: '' }])],
    });
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();

    fixture.componentRef.setInput('markdown', '# Second');
    fixture.detectChanges();
    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument();
  });
});
