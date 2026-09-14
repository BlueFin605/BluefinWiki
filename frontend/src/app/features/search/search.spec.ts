import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { RateLimitExceededError, Search, hasMoreResults } from './search';
import type { WikiSearchQuery, WikiSearchResultSet } from './search.types';

const baseQuery: WikiSearchQuery = {
  text: 'recipe',
  scope: 'all',
  limit: 10,
  offset: 0,
};

const sampleResponse: WikiSearchResultSet = {
  results: [
    {
      pageId: 'page-1',
      title: 'Family Recipes',
      snippet: 'pasta and pizza recipes',
      relevanceScore: 950,
      matchCount: 0,
      path: 'Cooking > Family Recipes',
      tags: ['recipe'],
    },
  ],
  totalResults: 1,
  executionTimeMs: 12,
};

describe('Search service', () => {
  let http: HttpTestingController;
  let search: Search;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    search = TestBed.inject(Search);
  });

  afterEach(() => http.verify());

  it('sends q/scope/limit/offset query params and returns the result set', async () => {
    const promise = search.search(baseQuery);

    const req = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('q') === 'recipe',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('recipe');
    expect(req.request.params.get('scope')).toBe('all');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush(sampleResponse);

    await expect(promise).resolves.toEqual(sampleResponse);
  });

  it('strips angle brackets from the query before sending', async () => {
    const promise = search.search({
      ...baseQuery,
      text: '<script>alert(1)</script>recipe',
    });

    const req = http.expectOne(
      (r) =>
        r.url === '/api/search' &&
        r.params.get('q') === 'scriptalert(1)/scriptrecipe',
    );
    req.flush(sampleResponse);
    await promise;
  });

  it('truncates queries longer than 500 chars', async () => {
    const longText = 'a'.repeat(1000);
    const promise = search.search({ ...baseQuery, text: longText });

    const req = http.expectOne((r) => r.url === '/api/search');
    expect(req.request.params.get('q')?.length).toBe(500);
    req.flush(sampleResponse);
    await promise;
  });

  it('returns an empty result set without calling the API for a blank query', async () => {
    const result = await search.search({ ...baseQuery, text: '   ' });
    expect(result).toEqual({
      results: [],
      totalResults: 0,
      executionTimeMs: 0,
    });
    // http.verify() in afterEach asserts no requests were issued.
  });

  it('returns an empty result set when sanitisation strips the query to nothing', async () => {
    const result = await search.search({ ...baseQuery, text: '<<<>>>' });
    expect(result).toEqual({
      results: [],
      totalResults: 0,
      executionTimeMs: 0,
    });
  });

  it('surfaces HTTP errors with the status', async () => {
    const promise = search.search(baseQuery);
    const req = http.expectOne((r) => r.url === '/api/search');
    req.flush('boom', { status: 503, statusText: 'Service Unavailable' });
    await expect(promise).rejects.toThrow('Search failed: 503');
  });
});

describe('Search rate limiting (step 6.3)', () => {
  let http: HttpTestingController;
  let search: Search;
  let now: number;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    search = TestBed.inject(Search);
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });

  /** Dispatches and flushes one successful search, advancing the fake clock by 1ms. */
  async function dispatchOne(text: string): Promise<void> {
    const promise = search.search({ ...baseQuery, text });
    http.expectOne((r) => r.url === '/api/search').flush(sampleResponse);
    await promise;
    now += 1;
  }

  it('allows 60 rapid dispatched searches and leaves rateLimited false', async () => {
    for (let i = 0; i < 60; i++) await dispatchOne(`q${i}`);
    expect(search.rateLimited()).toBe(false);
  });

  it('suppresses the 61st rapid dispatched search without hitting HttpClient and sets rateLimited', async () => {
    for (let i = 0; i < 60; i++) await dispatchOne(`q${i}`);

    await expect(search.search({ ...baseQuery, text: 'over-limit' })).rejects.toThrow(
      new RateLimitExceededError().message,
    );
    expect(search.rateLimited()).toBe(true);
    // http.verify() in afterEach confirms no request was issued for the 61st.
  });

  it('clears rateLimited once a later dispatch has capacity again', async () => {
    for (let i = 0; i < 60; i++) await dispatchOne(`q${i}`);
    await expect(search.search({ ...baseQuery, text: 'blocked' })).rejects.toThrow(
      RateLimitExceededError,
    );
    expect(search.rateLimited()).toBe(true);

    // Jump past the 60s window from the very first (oldest) dispatch.
    now = 1_000_000 + 60_000;
    await dispatchOne('recovered');

    expect(search.rateLimited()).toBe(false);
  });
});

function makeResults(count: number): WikiSearchResultSet['results'] {
  return Array.from({ length: count }, () => sampleResponse.results[0]);
}

describe('hasMoreResults', () => {
  it('is true when fewer results are loaded than the reported total', () => {
    expect(hasMoreResults({ results: makeResults(10), totalResults: 42 })).toBe(true);
  });

  it('is false once the loaded results cover the reported total', () => {
    expect(hasMoreResults({ results: makeResults(42), totalResults: 42 })).toBe(false);
  });

  it('is false for an empty result set with no total', () => {
    expect(hasMoreResults({ results: [], totalResults: 0 })).toBe(false);
  });
});
