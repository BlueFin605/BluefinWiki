import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { MarkdownRenderer } from './markdown-renderer';

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

  it('renders task list checkboxes', async () => {
    const el = await renderMd('- [x] done\n- [ ] todo');
    const inputs = el.querySelectorAll('input[type="checkbox"]');
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).checked).toBe(true);
    expect((inputs[1] as HTMLInputElement).checked).toBe(false);
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
