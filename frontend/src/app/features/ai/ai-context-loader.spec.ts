import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AiContextLoader } from './ai-context-loader';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('AiContextLoader', () => {
  let http: HttpTestingController;
  let loader: AiContextLoader;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    loader = TestBed.inject(AiContextLoader);
  });

  afterEach(() => http.verify());

  it('returns an empty string when no current page and message has no actionable hints', async () => {
    const promise = loader.buildRagContext({
      currentPageGuid: null,
      userMessage: 'hello',
    });
    await settle();
    const searchReq = http.expectOne((r) => r.url === '/api/search');
    expect(searchReq.request.params.get('q')).toBe('hello');
    searchReq.flush({ results: [], totalResults: 0, executionTimeMs: 1 });

    await expect(promise).resolves.toBe('');
  });

  it('loads the current page when guid is provided', async () => {
    const promise = loader.buildRagContext({
      currentPageGuid: 'page-1',
      userMessage: 'summarise this',
    });
    await settle();
    const pageReq = http.expectOne('/api/pages/page-1');
    pageReq.flush({
      guid: 'page-1',
      title: 'Salad',
      content: 'Lettuce, tomato',
      folderId: 'f',
      tags: ['food'],
      status: 'published',
      createdBy: 'u',
      modifiedBy: 'u',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
    });
    const searchReq = http.expectOne((r) => r.url === '/api/search');
    searchReq.flush({ results: [], totalResults: 0, executionTimeMs: 1 });
    await settle();

    const context = await promise;
    expect(context).toContain('Current page (the one the user is viewing):');
    expect(context).toContain('Title: Salad');
    expect(context).toContain('GUID: page-1');
    expect(context).toContain('Tags: food');
  });

  it('includes related pages from semantic search, excluding the current page', async () => {
    const promise = loader.buildRagContext({
      currentPageGuid: 'page-1',
      userMessage: 'recipes',
    });
    await settle();
    http.expectOne('/api/pages/page-1').flush({
      guid: 'page-1',
      title: 'Salad',
      content: '',
      folderId: 'f',
      tags: [],
      status: 'published',
      createdBy: 'u',
      modifiedBy: 'u',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
    });
    http.expectOne((r) => r.url === '/api/search').flush({
      results: [
        { pageId: 'page-1', title: 'Salad', snippet: 'a', relevanceScore: 1, matchCount: 0, path: '', tags: [] },
        { pageId: 'page-2', title: 'Pasta', snippet: 'noodles', relevanceScore: 0.9, matchCount: 0, path: '', tags: [] },
      ],
      totalResults: 2,
      executionTimeMs: 2,
    });
    await settle();

    const context = await promise;
    expect(context).toContain('Related pages (semantic search over the wiki):');
    expect(context).toContain('Pasta');
    // Current page should not be repeated in related list:
    const pastaIdx = context.indexOf('Pasta');
    const relatedHeaderIdx = context.indexOf('Related pages');
    expect(pastaIdx).toBeGreaterThan(relatedHeaderIdx);
  });

  it('loads page types when message hints at creation intent', async () => {
    const promise = loader.buildRagContext({
      currentPageGuid: null,
      userMessage: 'create a new typed page for me',
    });
    await settle();
    http.expectOne((r) => r.url === '/api/search').flush({
      results: [],
      totalResults: 0,
      executionTimeMs: 1,
    });
    await settle();
    const typesReq = http.expectOne('/api/page-types');
    typesReq.flush({
      pageTypes: [
        {
          guid: 'pt-1',
          name: 'Recipe',
          icon: '🍳',
          properties: [{ name: 'cuisine', type: 'string', required: false }],
          allowedChildTypes: [],
          allowWikiPageChildren: true,
          allowedParentTypes: [],
          allowAnyParent: true,
          createdBy: 'u',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    await settle();

    const context = await promise;
    expect(context).toContain('Available page types');
    expect(context).toContain('Recipe');
    expect(context).toContain('props:');
  });
});
