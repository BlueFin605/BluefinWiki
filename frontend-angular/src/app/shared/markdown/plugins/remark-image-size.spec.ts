import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkImageSize from './remark-image-size';

async function toHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkImageSize)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

describe('remark-image-size', () => {
  it('parses width-only with px', async () => {
    const html = await toHtml('![alt|300](image.png)');
    expect(html).toContain('width="300px"');
    expect(html).toContain('alt="alt"');
    expect(html).not.toContain('height=');
  });

  it('parses width-only with percent', async () => {
    const html = await toHtml('![alt|50%](image.png)');
    expect(html).toContain('width="50%"');
    expect(html).not.toContain('height=');
  });

  it('parses width-and-height with px', async () => {
    const html = await toHtml('![alt|300x200](image.png)');
    expect(html).toContain('width="300px"');
    expect(html).toContain('height="200px"');
  });

  it('parses width-and-height with percent', async () => {
    const html = await toHtml('![alt|50%x40%](image.png)');
    expect(html).toContain('width="50%"');
    expect(html).toContain('height="40%"');
  });

  it('strips the |SIZE suffix from alt text', async () => {
    const html = await toHtml('![My Image|300](image.png)');
    expect(html).toContain('alt="My Image"');
    expect(html).not.toContain('|300');
  });

  it('leaves images without |SIZE alone', async () => {
    const html = await toHtml('![just alt](image.png)');
    expect(html).toContain('alt="just alt"');
    expect(html).not.toContain('width=');
    expect(html).not.toContain('height=');
  });

  it('ignores non-numeric trailing data after the pipe', async () => {
    // `|notasize` does not match the SIZE_PATTERN, so the alt text stays as-is.
    const html = await toHtml('![Image|notasize](image.png)');
    expect(html).toContain('alt="Image|notasize"');
    expect(html).not.toContain('width=');
  });
});
