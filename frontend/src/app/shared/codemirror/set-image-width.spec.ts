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
});
