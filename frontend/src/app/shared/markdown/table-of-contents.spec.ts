import { render, screen } from '@testing-library/angular';
import { WikiTableOfContents } from './table-of-contents';

/**
 * jsdom has no `IntersectionObserver`. This stub records the instance and its
 * callback so a test can synthesise an intersection and assert the active
 * highlight. It mirrors the `wiki-image` / mermaid specs' pattern of stubbing a
 * missing browser API.
 */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly callback: IntersectionObserverCallback;
  readonly options?: IntersectionObserverInit;
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.disconnected = true;
    this.observed.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Test helper: fire the observer callback with the given entries. */
  fire(entries: Array<Partial<IntersectionObserverEntry>>): void {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }

  static last(): MockIntersectionObserver {
    return this.instances[this.instances.length - 1];
  }
}

/** Append real heading elements so `document.getElementById(slug)` resolves. */
function mountHeadings(...ids: string[]): HTMLElement[] {
  return ids.map((id) => {
    const h = document.createElement('h2');
    h.id = id;
    h.textContent = id;
    h.scrollIntoView = jest.fn();
    document.body.appendChild(h);
    return h;
  });
}

const THREE = ['## Alpha', '## Beta', '## Gamma'].join('\n\n');

describe('WikiTableOfContents', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    originalIO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      MockIntersectionObserver;
    window.location.hash = '';
  });

  afterEach(() => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = originalIO;
    document.body.querySelectorAll('h2[id]').forEach((el) => el.remove());
    window.location.hash = '';
  });

  it('renders nothing with fewer than 3 headings', async () => {
    const { container } = await render(WikiTableOfContents, {
      inputs: { markdown: '## Only One\n\n## Only Two' },
    });
    expect(container.querySelector('nav')).toBeNull();
    expect(screen.queryByText('On this page')).toBeNull();
  });

  it('renders the "On this page" rail with one entry per heading (>= 3)', async () => {
    mountHeadings('alpha', 'beta', 'gamma');
    await render(WikiTableOfContents, { inputs: { markdown: THREE } });

    expect(screen.getByText('On this page')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#alpha',
      '#beta',
      '#gamma',
    ]);
  });

  it('nests entries by heading level via a data-level attribute', async () => {
    mountHeadings('a-one', 'a-two', 'a-three');
    const { container } = await render(WikiTableOfContents, {
      inputs: { markdown: '## A One\n\n### A Two\n\n#### A Three' },
    });
    const levels = Array.from(container.querySelectorAll('li[data-level]')).map((li) =>
      li.getAttribute('data-level'),
    );
    expect(levels).toEqual(['2', '3', '4']);
  });

  it('smooth-scrolls to the target and reflects the hash without a history entry on click (I5)', async () => {
    const [, beta] = mountHeadings('alpha', 'beta', 'gamma');
    const scrollSpy = jest.fn();
    beta.scrollIntoView = scrollSpy;
    await render(WikiTableOfContents, { inputs: { markdown: THREE } });

    const replaceSpy = jest.spyOn(history, 'replaceState').mockClear();
    const pushSpy = jest.spyOn(history, 'pushState').mockClear();
    const lenBefore = history.length;

    const betaLink = screen.getByRole('link', { name: 'Beta' });
    betaLink.click();

    expect(scrollSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
    expect(window.location.hash).toBe('#beta');
    // The renderer's sibling anchor handler uses replaceState for the same
    // interaction — the TOC must not diverge by pushing history / instant-jumping.
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy.mock.calls[0].slice(1)).toEqual(['', '#beta']);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(history.length).toBe(lenBefore);

    jest.restoreAllMocks();
  });

  it('marks the entry reported active by the IntersectionObserver', async () => {
    const [, beta] = mountHeadings('alpha', 'beta', 'gamma');
    const { container, fixture } = await render(WikiTableOfContents, {
      inputs: { markdown: THREE },
    });

    const io = MockIntersectionObserver.last();
    expect(io).toBeDefined();

    io.fire([
      {
        target: beta,
        isIntersecting: true,
        boundingClientRect: { top: 12 } as DOMRectReadOnly,
      },
    ]);
    fixture.detectChanges();

    const active = container.querySelector('li.active');
    expect(active?.getAttribute('data-level')).toBe('2');
    expect(active?.textContent?.trim()).toBe('Beta');
    // I6: the highlight must not be visual-only.
    expect(active?.querySelector('a')?.getAttribute('aria-current')).toBe('location');
    // Non-active entries carry no aria-current.
    const inactive = container.querySelector('li:not(.active) a');
    expect(inactive?.getAttribute('aria-current')).toBeNull();
  });

  it('disconnects the IntersectionObserver on destroy', async () => {
    mountHeadings('alpha', 'beta', 'gamma');
    const { fixture } = await render(WikiTableOfContents, { inputs: { markdown: THREE } });

    const io = MockIntersectionObserver.last();
    expect(io.disconnected).toBe(false);

    fixture.destroy();
    expect(io.disconnected).toBe(true);
  });

  it('exposes a compact input (not yet wired to a responsive driver)', async () => {
    mountHeadings('alpha', 'beta', 'gamma');
    const { fixture } = await render(WikiTableOfContents, {
      inputs: { markdown: THREE, compact: true },
    });
    expect(fixture.componentInstance.compact()).toBe(true);
  });

  it('does not throw when IntersectionObserver is unavailable', async () => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
    mountHeadings('alpha', 'beta', 'gamma');
    await expect(
      render(WikiTableOfContents, { inputs: { markdown: THREE } }),
    ).resolves.toBeDefined();
  });
});
