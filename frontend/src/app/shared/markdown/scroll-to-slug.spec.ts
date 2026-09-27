import { scrollToSlug } from './scroll-to-slug';

describe('scrollToSlug', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.querySelectorAll('[id]').forEach((el) => el.remove());
    history.replaceState(null, '', location.pathname + location.search);
  });

  it('smooth-scrolls to the matching element and reflects the slug via replaceState', () => {
    const h = document.createElement('h2');
    h.id = 'intro-section';
    const scrollSpy = jest.fn();
    h.scrollIntoView = scrollSpy;
    document.body.appendChild(h);

    const replaceSpy = jest.spyOn(history, 'replaceState').mockClear();
    const pushSpy = jest.spyOn(history, 'pushState').mockClear();
    const lenBefore = history.length;

    scrollToSlug('intro-section');

    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy.mock.calls[0].slice(1)).toEqual(['', '#intro-section']);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(history.length).toBe(lenBefore);
    expect(window.location.hash).toBe('#intro-section');
  });

  it('still reflects the hash when no element matches the slug', () => {
    scrollToSlug('nothing-here');
    expect(window.location.hash).toBe('#nothing-here');
  });

  it('is a no-op for an empty slug', () => {
    const replaceSpy = jest.spyOn(history, 'replaceState').mockClear();
    scrollToSlug('');
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('falls back to location.hash when replaceState throws', () => {
    jest.spyOn(history, 'replaceState').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => scrollToSlug('fallback-slug')).not.toThrow();
    expect(window.location.hash).toBe('#fallback-slug');
  });
});
