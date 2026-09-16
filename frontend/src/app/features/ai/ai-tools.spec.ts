import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AiTools } from './ai-tools';

describe('AiTools', () => {
  let http: HttpTestingController;
  let tools: AiTools;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    tools = TestBed.inject(AiTools);
  });

  afterEach(() => {
    http.verify();
  });

  it('fetchUrl POSTs the url to /api/fetch-url and returns the body', async () => {
    const promise = tools.fetchUrl('https://example.com/article');

    const req = http.expectOne('/api/fetch-url');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ url: 'https://example.com/article' });
    req.flush({
      url: 'https://example.com/article',
      title: 'Article',
      text: 'Some content',
      contentType: 'text/html',
      truncated: false,
    });

    await expect(promise).resolves.toEqual({
      url: 'https://example.com/article',
      title: 'Article',
      text: 'Some content',
      contentType: 'text/html',
      truncated: false,
    });
  });

  it('fetchImdbShow GETs /api/imdb/show-details with a query param', async () => {
    const promise = tools.fetchImdbShow({ query: 'Breaking Bad' });

    const req = http.expectOne(
      (r) => r.url === '/api/imdb/show-details' && r.params.get('query') === 'Breaking Bad',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('imdbId')).toBe(false);
    req.flush({
      query: 'Breaking Bad',
      imdbId: 'tt0903747',
      title: 'Breaking Bad',
      synopsis: 'A chemistry teacher...',
      seasons: 5,
      rating: 9.5,
      votes: 2000000,
      url: 'https://www.imdb.com/title/tt0903747/',
    });

    const result = await promise;
    expect(result.imdbId).toBe('tt0903747');
    expect(result.title).toBe('Breaking Bad');
  });

  it('fetchImdbShow GETs with an imdbId param and omits an unset query', async () => {
    const promise = tools.fetchImdbShow({ imdbId: 'tt0903747' });

    const req = http.expectOne(
      (r) => r.url === '/api/imdb/show-details' && r.params.get('imdbId') === 'tt0903747',
    );
    expect(req.request.params.has('query')).toBe(false);
    req.flush({
      imdbId: 'tt0903747',
      title: 'Breaking Bad',
      synopsis: 'A chemistry teacher...',
      url: 'https://www.imdb.com/title/tt0903747/',
    });

    await promise;
  });
});
