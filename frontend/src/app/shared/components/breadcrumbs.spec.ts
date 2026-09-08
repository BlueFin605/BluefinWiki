import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Breadcrumbs } from './breadcrumbs';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

const originalMatchMedia = window.matchMedia;

/** Override the global jsdom `matchMedia` stub so the collapse gate can be
 *  driven from a test. Restored in `afterEach`. */
function setViewport(mobile: boolean): void {
  const stub: (query: string) => MediaQueryList = (query) => ({
    matches: mobile && /max-width/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
  window.matchMedia = stub;
}

function makeAncestor(n: number): Record<string, unknown> {
  return {
    guid: `g${n}`,
    title: `Ancestor ${n}`,
    parentGuid: n === 1 ? null : `g${n - 1}`,
    status: 'published',
    modifiedAt: '',
    modifiedBy: '',
    hasChildren: true,
  };
}

async function renderBreadcrumbs(opts: {
  currentTitle?: string;
  ancestors: unknown[];
}): Promise<Awaited<ReturnType<typeof render>>> {
  const view = await render(Breadcrumbs, {
    inputs: { guid: 'g1', currentTitle: opts.currentTitle ?? 'Current Page' },
    providers: [
      provideRouter([
        { path: 'pages', children: [] },
        { path: 'pages/:guid', children: [] },
      ]),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/pages/g1/ancestors').flush({ ancestors: opts.ancestors });
  await settle();
  view.fixture.detectChanges();
  return view;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('Breadcrumbs', () => {
  it('renders ancestor links and the current title', async () => {
    setViewport(false);
    await renderBreadcrumbs({
      currentTitle: 'Deep Page',
      ancestors: [makeAncestor(1), makeAncestor(2)],
    });
    expect(screen.getByRole('link', { name: 'Ancestor 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ancestor 2' })).toBeInTheDocument();
    expect(screen.getByText('Deep Page')).toBeInTheDocument();
  });

  it('renders the current title (no ancestor links) when there are no ancestors', async () => {
    setViewport(false);
    await renderBreadcrumbs({ currentTitle: 'Root Page', ancestors: [] });
    expect(screen.getByText('Root Page')).toBeInTheDocument();
    // Only the leading Home segment is a link.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Home');
  });

  it('renders a leading Home segment linking to /pages', async () => {
    setViewport(false);
    await renderBreadcrumbs({ ancestors: [makeAncestor(1)] });
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toBeInTheDocument();
    expect(home).toHaveAttribute('href', '/pages');
  });

  it('navigates to /pages when Home is clicked (clears the active page selection)', async () => {
    setViewport(false);
    await renderBreadcrumbs({ ancestors: [makeAncestor(1), makeAncestor(2)] });
    await userEvent.click(screen.getByRole('link', { name: 'Home' }));
    await settle();
    expect(TestBed.inject(Router).url).toBe('/pages');
  });

  it('collapses the middle to an ellipsis when >3 segments and the viewport is mobile', async () => {
    setViewport(true);
    await renderBreadcrumbs({
      currentTitle: 'Current Page',
      ancestors: [1, 2, 3, 4, 5].map(makeAncestor),
    });
    // Home … Current
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.getByText('Current Page')).toBeInTheDocument();
    // The middle ancestor links are hidden behind the ellipsis.
    expect(screen.queryByRole('link', { name: 'Ancestor 3' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ancestor 5' })).toBeNull();
  });

  it('renders the full trail on desktop even with >3 segments', async () => {
    setViewport(false);
    await renderBreadcrumbs({
      currentTitle: 'Current Page',
      ancestors: [1, 2, 3, 4, 5].map(makeAncestor),
    });
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('link', { name: `Ancestor ${n}` })).toBeInTheDocument();
    }
    expect(screen.queryByText('…')).toBeNull();
  });

  it('never collapses when there are 3 or fewer segments, even on mobile', async () => {
    setViewport(true);
    await renderBreadcrumbs({
      currentTitle: 'Current Page',
      ancestors: [makeAncestor(1)],
    });
    expect(screen.getByRole('link', { name: 'Ancestor 1' })).toBeInTheDocument();
    expect(screen.queryByText('…')).toBeNull();
  });

  it('truncates every segment with a title tooltip carrying the full text', async () => {
    setViewport(false);
    await renderBreadcrumbs({
      currentTitle: 'A Very Long Current Page Title That Would Overflow',
      ancestors: [makeAncestor(1)],
    });

    const home = screen.getByRole('link', { name: 'Home' });
    const ancestor = screen.getByRole('link', { name: 'Ancestor 1' });
    const current = screen.getByText('A Very Long Current Page Title That Would Overflow');

    // Every segment carries the `.crumb` class, which owns the
    // `max-width: 200px` + `text-overflow: ellipsis` truncation rule.
    for (const el of [home, ancestor, current]) {
      expect(el).toHaveClass('crumb');
    }
    expect(home).toHaveAttribute('title', 'Home');
    expect(ancestor).toHaveAttribute('title', 'Ancestor 1');
    expect(current).toHaveAttribute(
      'title',
      'A Very Long Current Page Title That Would Overflow',
    );
  });

  it('gives the collapsed ellipsis a title listing the hidden ancestors', async () => {
    setViewport(true);
    await renderBreadcrumbs({ ancestors: [1, 2, 3, 4, 5].map(makeAncestor) });
    const ellipsis = screen.getByText('…');
    expect(ellipsis).toHaveClass('crumb');
    expect(ellipsis).toHaveAttribute(
      'title',
      'Ancestor 1 / Ancestor 2 / Ancestor 3 / Ancestor 4 / Ancestor 5',
    );
  });

  it('marks the last crumb with aria-current="page" (I6)', async () => {
    setViewport(false);
    await renderBreadcrumbs({ currentTitle: 'Deep Page', ancestors: [makeAncestor(1)] });
    expect(screen.getByText('Deep Page')).toHaveAttribute('aria-current', 'page');
  });

  it('gives the collapsed ellipsis an accessible name (I6)', async () => {
    setViewport(true);
    await renderBreadcrumbs({ ancestors: [1, 2, 3, 4, 5].map(makeAncestor) });
    expect(screen.getByText('…')).toHaveAttribute(
      'aria-label',
      'Show hidden breadcrumb segments',
    );
  });
});
