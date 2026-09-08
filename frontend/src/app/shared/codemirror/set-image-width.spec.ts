import { setImageWidth } from './set-image-width';

describe('setImageWidth', () => {
  it('adds a width to an image token that has none (matched by alt)', () => {
    expect(setImageWidth('![a](x.png)', 'a', 300)).toBe('![a|300](x.png)');
  });

  it('replaces an existing width (matched by alt)', () => {
    expect(setImageWidth('![a|100](x.png)', 'a', 300)).toBe('![a|300](x.png)');
  });

  it('matches by zero-based image index', () => {
    expect(setImageWidth('![a](x.png)', 0, 300)).toBe('![a|300](x.png)');
    expect(setImageWidth('![a](1.png) then ![b](2.png)', 1, 50)).toBe(
      '![a](1.png) then ![b|50](2.png)',
    );
  });

  // I2: the common case is `![](x.png)` with no alt — every such image shares
  // the empty-string key, so an alt match rewrites them all. Index targeting
  // rewrites exactly one.
  it('by index rewrites only the targeted empty-alt image among several', () => {
    expect(setImageWidth('![](a.png) ![](b.png) ![](c.png)', 1, 200)).toBe(
      '![](a.png) ![|200](b.png) ![](c.png)',
    );
  });

  it('by empty-alt string still rewrites every empty-alt image (documents the I2 hazard)', () => {
    expect(setImageWidth('![](a.png) ![](b.png)', '', 200)).toBe(
      '![|200](a.png) ![|200](b.png)',
    );
  });

  it('by index rewrites only one of two images that share the same non-empty alt', () => {
    expect(setImageWidth('![pic](a.png) ![pic](b.png)', 0, 90)).toBe(
      '![pic|90](a.png) ![pic](b.png)',
    );
  });

  it('leaves the markdown unchanged when nothing matches', () => {
    expect(setImageWidth('![a](x.png)', 'missing', 300)).toBe('![a](x.png)');
    expect(setImageWidth('![a](x.png)', 4, 300)).toBe('![a](x.png)');
  });

  it('rounds a fractional width', () => {
    expect(setImageWidth('![a](x.png)', 'a', 247.8)).toBe('![a|248](x.png)');
  });

  it('strips the width when passed a non-positive value', () => {
    expect(setImageWidth('![a|120](x.png)', 'a', 0)).toBe('![a](x.png)');
  });

  it('does not rewrite an image token inside a fenced code block', () => {
    const md = ['```', '![a](x.png)', '```', '', '![a](y.png)'].join('\n');
    expect(setImageWidth(md, 'a', 300)).toBe(
      ['```', '![a](x.png)', '```', '', '![a|300](y.png)'].join('\n'),
    );
  });

  it('does not rewrite an image token inside a tilde fenced code block', () => {
    const md = ['~~~', '![a](x.png)', '~~~'].join('\n');
    expect(setImageWidth(md, 'a', 300)).toBe(md);
  });

  it('does not rewrite an image token inside an inline code span', () => {
    expect(setImageWidth('`![a](x.png)` and ![a](y.png)', 'a', 300)).toBe(
      '`![a](x.png)` and ![a|300](y.png)',
    );
  });

  it('counts only non-code images when matching by numeric index', () => {
    const md = ['```', '![a](code.png)', '```', '', '![b](0.png) ![c](1.png)'].join('\n');
    expect(setImageWidth(md, 1, 99)).toBe(
      ['```', '![a](code.png)', '```', '', '![b](0.png) ![c|99](1.png)'].join('\n'),
    );
  });
});
