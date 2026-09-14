import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Component } from '@angular/core';

import { SearchDialog } from './search-dialog';
import { RateLimitExceededError, Search } from './search';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * jsdom has no `IntersectionObserver`. This stub records instances/callbacks
 * so a test can synthesise an intersection — mirrors
 * `table-of-contents.spec.ts`'s pattern for the same gap.
 */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly callback: IntersectionObserverCallback;
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
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

  fire(entries: Array<Partial<IntersectionObserverEntry>>): void {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }

  static last(): MockIntersectionObserver {
    return this.instances[this.instances.length - 1];
  }
}

interface DialogRefStub {
  close: jest.Mock;
}

function makeDialogRef(): DialogRefStub {
  return { close: jest.fn() };
}

function baseProviders(dialogRef: DialogRefStub) {
  return [
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([{ path: 'pages/:guid', component: NoopPage }]),
    { provide: MatDialogRef, useValue: dialogRef },
  ];
}

@Component({ standalone: true, template: '' })
class NoopPage {}

/** Renders the dialog, types a query, and flushes a fixed 3-result response. */
async function seedThreeResults(dialogRef: DialogRefStub): Promise<{
  input: HTMLElement;
  http: HttpTestingController;
}> {
  await render(SearchDialog, { providers: baseProviders(dialogRef) });
  const http = TestBed.inject(HttpTestingController);
  const input = screen.getByPlaceholderText(/search wiki/i);
  const user = userEvent.setup();
  await user.type(input, 'thing');
  await wait(260);
  await settle();

  http.expectOne((r) => r.url === '/api/search').flush({
    results: [
      { pageId: 'g1', title: 'One', snippet: '', relevanceScore: 900, matchCount: 0, path: 'p1', tags: [] },
      { pageId: 'g2', title: 'Two', snippet: '', relevanceScore: 800, matchCount: 0, path: 'p2', tags: [] },
      { pageId: 'g3', title: 'Three', snippet: '', relevanceScore: 700, matchCount: 0, path: 'p3', tags: [] },
    ],
    totalResults: 3,
    executionTimeMs: 2,
  });
  await settle();
  await screen.findByText('One');

  return { input, http };
}

/** Builds `count` distinct result rows starting at `offset` (for paging fixtures). */
function makeResults(offset: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = offset + i;
    return {
      pageId: `g${n}`,
      title: `Result ${n}`,
      snippet: '',
      relevanceScore: 900 - n,
      matchCount: 0,
      path: `p${n}`,
      tags: [],
    };
  });
}

/** Renders the dialog, types a query, and flushes a page-1 response out of `total`. */
async function seedPaginatedResults(
  dialogRef: DialogRefStub,
  total: number,
): Promise<{ input: HTMLElement; http: HttpTestingController }> {
  await render(SearchDialog, { providers: baseProviders(dialogRef) });
  const http = TestBed.inject(HttpTestingController);
  const input = screen.getByPlaceholderText(/search wiki/i);
  const user = userEvent.setup();
  await user.type(input, 'thing');
  await wait(260);
  await settle();

  http
    .expectOne((r) => r.url === '/api/search' && r.params.get('offset') === '0')
    .flush({ results: makeResults(0, 10), totalResults: total, executionTimeMs: 2 });
  await settle();
  await screen.findByText('Result 0');

  return { input, http };
}

describe('SearchDialog', () => {
  it('renders an input and an empty state when nothing has been typed', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    expect(
      screen.getByPlaceholderText(/search wiki/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/start typing/i)).toBeInTheDocument();
  });

  it('debounces input and sends a search request after the user stops typing', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    const http = TestBed.inject(HttpTestingController);

    const input = screen.getByPlaceholderText(/search wiki/i);
    const user = userEvent.setup();
    await user.type(input, 'recipe');

    // Wait for debounce (200ms) + microtasks
    await wait(260);
    await settle();

    const req = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('q') === 'recipe',
    );
    req.flush({
      results: [
        {
          pageId: 'p1',
          title: 'Family Recipes',
          snippet: 'pasta',
          relevanceScore: 900,
          matchCount: 0,
          path: 'Cooking > Family Recipes',
          tags: ['recipe'],
        },
      ],
      totalResults: 1,
      executionTimeMs: 9,
    });
    await settle();

    expect(await screen.findByText('Family Recipes')).toBeInTheDocument();
    expect(screen.getByText(/pasta/i)).toBeInTheDocument();
  });

  it('changes the scope query when the toggle is switched', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    const http = TestBed.inject(HttpTestingController);

    const input = screen.getByPlaceholderText(/search wiki/i);
    const user = userEvent.setup();
    await user.type(input, 'cook');
    await wait(260);
    await settle();
    http
      .expectOne((r) => r.url === '/api/search' && r.params.get('scope') === 'all')
      .flush({ results: [], totalResults: 0, executionTimeMs: 1 });
    await settle();

    // Switch to "Titles" scope.
    const titlesToggle = screen.getByRole('radio', { name: /titles/i });
    await user.click(titlesToggle);
    await wait(260);
    await settle();

    const req = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('scope') === 'titles',
    );
    req.flush({ results: [], totalResults: 0, executionTimeMs: 1 });
    await settle();
    expect(req.request.params.get('q')).toBe('cook');
  });

  it('does not hit the API when the input is blank', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    const http = TestBed.inject(HttpTestingController);

    await wait(260);
    await settle();
    http.verify(); // no requests
    expect(screen.getByText(/start typing/i)).toBeInTheDocument();
  });

  it('navigates and closes when a result is clicked', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    const router = TestBed.inject(Router);
    const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const http = TestBed.inject(HttpTestingController);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search wiki/i), 'thing');
    await wait(260);
    await settle();

    http
      .expectOne((r) => r.url === '/api/search')
      .flush({
        results: [
          {
            pageId: 'guid-42',
            title: 'The Thing',
            snippet: '',
            relevanceScore: 800,
            matchCount: 0,
            path: 'Root > Thing',
            tags: [],
          },
        ],
        totalResults: 1,
        executionTimeMs: 2,
      });
    await settle();

    const result = await screen.findByRole('option', { name: /the thing/i });
    await user.click(result);
    await settle();

    expect(navSpy).toHaveBeenCalledWith(['/pages', 'guid-42']);
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('ArrowDown/ArrowUp move the highlighted row and update aria-selected + aria-activedescendant', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    let options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('id', 'search-result-0');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-0');
    // Visual indicator, not just the ARIA attribute — a sighted user must see
    // which row is highlighted before pressing Enter.
    expect(options[0]).toHaveClass('selected');
    expect(options[1]).not.toHaveClass('selected');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-1');
    expect(options[0]).not.toHaveClass('selected');
    expect(options[1]).toHaveClass('selected');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await settle();
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-0');
    expect(options[0]).toHaveClass('selected');
  });

  it('ArrowUp at the top and ArrowDown at the bottom clamp instead of wrapping', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-0');

    fireEvent.keyDown(input, { key: 'End' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-2');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-2');
  });

  it('Home/End jump to the first/last result', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'End' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-2');

    fireEvent.keyDown(input, { key: 'Home' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-0');
  });

  it('Enter navigates to the highlighted result and closes the dialog', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);
    const router = TestBed.inject(Router);
    const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();

    expect(navSpy).toHaveBeenCalledWith(['/pages', 'g2']);
    expect(dialogRef.close).toHaveBeenCalledWith('g2');
  });

  it('Ctrl/Cmd+Enter opens the highlighted result in a new tab and leaves the dialog open', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const router = TestBed.inject(Router);
    const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await settle();

    expect(openSpy).toHaveBeenCalledWith('/pages/g1', '_blank');
    expect(navSpy).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    await settle();

    expect(openSpy).toHaveBeenCalledWith('/pages/g2', '_blank');
    expect(dialogRef.close).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it('hovering a row sets it as the current selection', async () => {
    const dialogRef = makeDialogRef();
    await seedThreeResults(dialogRef);

    const options = screen.getAllByRole('option');
    fireEvent.mouseEnter(options[2]);
    await settle();

    expect(options[2]).toHaveAttribute('aria-selected', 'true');
    expect(options[2]).toHaveClass('selected');
    expect(screen.getByPlaceholderText(/search wiki/i)).toHaveAttribute(
      'aria-activedescendant',
      'search-result-2',
    );
  });

  it('scrolls the selected row into view', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);
    const scrollSpy = jest.fn();
    for (const option of screen.getAllByRole('option')) {
      option.scrollIntoView = scrollSpy;
    }

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();

    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('resets the selection when the result list changes', async () => {
    const dialogRef = makeDialogRef();
    const { input, http } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-1');

    const user = userEvent.setup();
    await user.type(input, ' else');
    await wait(260);
    await settle();
    http
      .expectOne((r) => r.url === '/api/search' && r.params.get('q') === 'thing else')
      .flush({
        results: [
          { pageId: 'g9', title: 'Fresh', snippet: '', relevanceScore: 900, matchCount: 0, path: 'p9', tags: [] },
        ],
        totalResults: 1,
        executionTimeMs: 1,
      });
    await settle();
    await screen.findByText('Fresh');

    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('resets the selection immediately (not after the debounce) when the query is cleared', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-2');

    const user = userEvent.setup();
    await user.clear(input);
    // Deliberately no `wait(260)` for the debounce here — clearing the input
    // bypasses the debounce/switchMap pipeline entirely (onQueryChange sets
    // IDLE_STATE synchronously), so the selection reset must be immediate,
    // not dependent on the pipeline's own ~200ms-later emission.
    await settle();

    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.getByText(/start typing/i)).toBeInTheDocument();
    // The stale row's id must not still be referenced anywhere either.
    expect(screen.queryByText('One')).toBeNull();
  });
});

describe('SearchDialog pagination (step 6.2)', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    originalIO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
  });

  afterEach(() => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = originalIO;
  });

  it('shows "Load more results (N of M)" after page 1 when more results remain', async () => {
    const dialogRef = makeDialogRef();
    await seedPaginatedResults(dialogRef, 42);

    expect(
      screen.getByRole('button', { name: /load more results \(10 of 42\)/i }),
    ).toBeInTheDocument();
    // The plain result-count footer only appears once nothing more remains.
    expect(screen.queryByText(/^10 result/i)).toBeNull();
  });

  it('clicking "Load more" requests the next offset and appends the results', async () => {
    const dialogRef = makeDialogRef();
    const { http } = await seedPaginatedResults(dialogRef, 42);

    fireEvent.click(screen.getByRole('button', { name: /load more results/i }));

    const req = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('offset') === '10',
    );
    expect(req.request.params.get('limit')).toBe('10');
    req.flush({ results: makeResults(10, 10), totalResults: 42, executionTimeMs: 3 });
    await settle();

    await screen.findByText('Result 19');
    expect(screen.getByText('Result 0')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(20);
    expect(
      screen.getByRole('button', { name: /load more results \(20 of 42\)/i }),
    ).toBeInTheDocument();
  });

  it('hides "Load more" and shows the plain footer once every result is loaded', async () => {
    const dialogRef = makeDialogRef();
    const { http } = await seedPaginatedResults(dialogRef, 13);

    fireEvent.click(screen.getByRole('button', { name: /load more results/i }));
    http
      .expectOne((r) => r.url === '/api/search' && r.params.get('offset') === '10')
      .flush({ results: makeResults(10, 3), totalResults: 13, executionTimeMs: 3 });
    await settle();
    await screen.findByText('Result 12');

    expect(screen.queryByRole('button', { name: /load more results/i })).toBeNull();
    expect(screen.getByText(/13 result/i)).toBeInTheDocument();
  });

  it('changing the page size re-runs the search from scratch', async () => {
    const dialogRef = makeDialogRef();
    const { http } = await seedPaginatedResults(dialogRef, 42);

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: '25' }));
    await wait(260);
    await settle();

    const req = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('offset') === '0',
    );
    expect(req.request.params.get('limit')).toBe('25');
    req.flush({ results: makeResults(0, 25), totalResults: 42, executionTimeMs: 4 });
    await settle();
    await screen.findByText('Result 24');

    // Reset, not appended: exactly the new page's 25 rows, not 10 + 25.
    expect(screen.getAllByRole('option')).toHaveLength(25);
    expect(
      screen.getByRole('button', { name: /load more results \(25 of 42\)/i }),
    ).toBeInTheDocument();
  });

  it('preserves the highlighted selection across a "Load more" append', async () => {
    const dialogRef = makeDialogRef();
    const { input, http } = await seedPaginatedResults(dialogRef, 42);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-1');

    fireEvent.click(screen.getByRole('button', { name: /load more results/i }));
    http
      .expectOne((r) => r.url === '/api/search' && r.params.get('offset') === '10')
      .flush({ results: makeResults(10, 10), totalResults: 42, executionTimeMs: 3 });
    await settle();
    await screen.findByText('Result 19');

    // Still row 1 highlighted — an append must not reset selection the way a
    // genuinely new result set (new query/scope/page-size) does.
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-1');
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveTextContent('Result 1');
  });

  it('auto-loads the next page when the "Load more" control scrolls into view', async () => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      MockIntersectionObserver;
    const dialogRef = makeDialogRef();
    const { http } = await seedPaginatedResults(dialogRef, 42);
    await settle();

    const io = MockIntersectionObserver.last();
    expect(io).toBeDefined();

    io.fire([{ isIntersecting: true }]);
    await settle();

    const req = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('offset') === '10',
    );
    req.flush({ results: makeResults(10, 10), totalResults: 42, executionTimeMs: 3 });
    await settle();
    await screen.findByText('Result 19');
  });

  it('discards a stale "Load more" response that resolves after a newer query has reset the results', async () => {
    const dialogRef = makeDialogRef();
    const { input, http } = await seedPaginatedResults(dialogRef, 42);

    fireEvent.click(screen.getByRole('button', { name: /load more results/i }));
    const staleReq = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('offset') === '10',
    );

    // A new query lands (and resolves) while the "Load more" request above is
    // still in flight.
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'else');
    await wait(260);
    await settle();
    http
      .expectOne((r) => r.url === '/api/search' && r.params.get('q') === 'else')
      .flush({ results: makeResults(100, 5), totalResults: 5, executionTimeMs: 1 });
    await settle();
    await screen.findByText('Result 100');

    // The stale page-2 response for the old query now resolves.
    staleReq.flush({ results: makeResults(10, 10), totalResults: 42, executionTimeMs: 3 });
    await settle();

    // Only the fresh reset's 5 results are shown — the stale append never landed.
    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(screen.queryByText('Result 10')).toBeNull();
  });
});

describe('SearchDialog rate limiting (step 6.3)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows "Too many searches" and preserves the prior results when the debounced query is rate-limited', async () => {
    const dialogRef = makeDialogRef();
    const { input, http } = await seedThreeResults(dialogRef);
    const search = TestBed.inject(Search);
    jest.spyOn(search, 'search').mockImplementation(() => {
      search.rateLimited.set(true);
      return Promise.reject(new RateLimitExceededError());
    });

    const user = userEvent.setup();
    await user.type(input, ' else');
    await wait(260);
    await settle();

    expect(screen.getByText(/too many searches\. please wait a moment\./i)).toBeInTheDocument();
    // The suppressed dispatch did not clobber the previously loaded results.
    expect(screen.getByText('One')).toBeInTheDocument();
    // Spinner must not be stuck showing "loading" forever for a suppressed request.
    expect(screen.queryByLabelText(/searching/i)).toBeNull();
    http.verify(); // Search.search was mocked, so nothing reached HttpClient.
  });

  it('hides the message once the query box is cleared', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);
    const search = TestBed.inject(Search);
    jest.spyOn(search, 'search').mockImplementation(() => {
      search.rateLimited.set(true);
      return Promise.reject(new RateLimitExceededError());
    });

    const user = userEvent.setup();
    await user.type(input, ' else');
    await wait(260);
    await settle();
    expect(screen.getByText(/too many searches/i)).toBeInTheDocument();

    await user.clear(input);
    await settle();

    expect(screen.queryByText(/too many searches/i)).toBeNull();
    expect(screen.getByText(/start typing/i)).toBeInTheDocument();
  });

  it('shows the message and leaves loaded results/pagination in place when "Load more" is rate-limited', async () => {
    const dialogRef = makeDialogRef();
    const { http } = await seedPaginatedResults(dialogRef, 42);
    const search = TestBed.inject(Search);
    jest.spyOn(search, 'search').mockImplementation(() => {
      search.rateLimited.set(true);
      return Promise.reject(new RateLimitExceededError());
    });

    fireEvent.click(screen.getByRole('button', { name: /load more results/i }));
    await settle();

    expect(screen.getByText(/too many searches\. please wait a moment\./i)).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(10);
    expect(
      screen.getByRole('button', { name: /load more results \(10 of 42\)/i }),
    ).toBeInTheDocument();
    http.verify(); // Search.search was mocked, so nothing reached HttpClient.
  });

  it('recovers: a later successful dispatch clears the message', async () => {
    const dialogRef = makeDialogRef();
    const { input, http } = await seedThreeResults(dialogRef);
    const search = TestBed.inject(Search);
    const realSearch = search.search.bind(search);
    jest
      .spyOn(search, 'search')
      .mockImplementationOnce(() => {
        search.rateLimited.set(true);
        return Promise.reject(new RateLimitExceededError());
      })
      .mockImplementation((query) => realSearch(query));

    const user = userEvent.setup();
    await user.type(input, ' else');
    await wait(260);
    await settle();
    expect(screen.getByText(/too many searches/i)).toBeInTheDocument();

    await user.type(input, ' again');
    await wait(260);
    await settle();
    http
      .expectOne((r) => r.url === '/api/search' && r.params.get('q') === 'thing else again')
      .flush({
        results: [
          { pageId: 'g9', title: 'Recovered', snippet: '', relevanceScore: 900, matchCount: 0, path: 'p9', tags: [] },
        ],
        totalResults: 1,
        executionTimeMs: 1,
      });
    await settle();

    expect(await screen.findByText('Recovered')).toBeInTheDocument();
    expect(screen.queryByText(/too many searches/i)).toBeNull();
  });
});
