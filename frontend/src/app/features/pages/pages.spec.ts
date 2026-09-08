import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { Pages } from './pages';
import type { PageContent, PageSummary } from './page.types';

function summary(over: Partial<PageSummary> = {}): PageSummary {
  return {
    guid: 'g',
    title: 'T',
    parentGuid: null,
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

function pageContent(over: Partial<PageContent> = {}): PageContent {
  return {
    guid: 'g',
    title: 'T',
    content: '# T',
    folderId: 'f',
    tags: [],
    status: 'published',
    createdBy: 'u',
    modifiedBy: 'u',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('Pages service', () => {
  let http: HttpTestingController;
  let pages: Pages;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Pages],
    });
    http = TestBed.inject(HttpTestingController);
    pages = TestBed.inject(Pages);
  });

  afterEach(() => http.verify());

  describe('childrenResource', () => {
    it('GETs /api/pages/root/children when parent is null', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      const req = http.expectOne('/api/pages/root/children');
      expect(req.request.method).toBe('GET');
      req.flush({ children: [summary({ guid: 'r1' })] });

      await settle();
      expect(resource.value()?.[0].guid).toBe('r1');
    });

    it('GETs /api/pages/{guid}/children when parent is set', async () => {
      const parent = signal<string | null>('parent-guid');
      TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      http.expectOne('/api/pages/parent-guid/children').flush({ children: [] });
    });

    it('reruns the loader when parent signal changes', async () => {
      const parent = signal<string | null>('a');
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      http.expectOne('/api/pages/a/children').flush({ children: [summary({ guid: 'aa' })] });
      await settle();

      parent.set('b');
      await settle();
      http.expectOne('/api/pages/b/children').flush({ children: [summary({ guid: 'bb' })] });
      await settle();

      expect(resource.value()?.[0].guid).toBe('bb');
    });

    it('re-requests after a createPage under the same parent (scoped invalidation)', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'v1' })] });
      await settle();

      const promise = pages.createPage({ title: 'New', parentGuid: null });
      http.expectOne('/api/pages').flush(pageContent({ guid: 'new', title: 'New' }));
      await promise;
      await settle();

      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'v2' })] });
      await settle();

      expect(resource.value()?.[0].guid).toBe('v2');
    });

    it('createPage under parent A refetches childrenResource(A) but NOT an unrelated pageResource', async () => {
      const parentA = signal<string | null>('A');
      const otherGuid = signal<string | null>('other');
      const childrenA = TestBed.runInInjectionContext(() => pages.childrenResource(parentA));
      TestBed.runInInjectionContext(() => pages.pageResource(otherGuid));

      await settle();
      http.expectOne('/api/pages/A/children').flush({ children: [] });
      http.expectOne('/api/pages/other').flush(pageContent({ guid: 'other' }));
      await settle();

      const promise = pages.createPage({ title: 'X', parentGuid: 'A' });
      http.expectOne('/api/pages').flush(pageContent({ guid: 'x' }));
      await promise;
      await settle();

      // children of A re-requests...
      http.expectOne('/api/pages/A/children').flush({ children: [summary({ guid: 'x' })] });
      // ...the unrelated page resource does not.
      http.expectNone('/api/pages/other');
      await settle();

      expect(childrenA.value()?.[0].guid).toBe('x');
    });
  });

  describe('pageResource', () => {
    it('GETs /api/pages/{guid}', async () => {
      const guid = signal<string | null>('p1');
      const resource = TestBed.runInInjectionContext(() => pages.pageResource(guid));
      await settle();
      http.expectOne('/api/pages/p1').flush(pageContent({ guid: 'p1', title: 'Hello' }));
      await settle();
      expect(resource.value()?.title).toBe('Hello');
    });

    it('does not fetch when guid is null', async () => {
      const guid = signal<string | null>(null);
      TestBed.runInInjectionContext(() => pages.pageResource(guid));
      await settle();
      http.expectNone(() => true);
    });
  });

  describe('mutations', () => {
    it('updatePage PUTs /api/pages/{guid} and returns the response', async () => {
      const promise = pages.updatePage('g1', { title: 'New' });
      const req = http.expectOne('/api/pages/g1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ title: 'New' });
      req.flush(pageContent({ guid: 'g1', title: 'New' }));
      const result = await promise;
      expect(result.title).toBe('New');
    });

    it('movePage PUTs /api/pages/{guid}/move', async () => {
      const promise = pages.movePage('g1', { newParentGuid: 'parent-2' });
      const req = http.expectOne('/api/pages/g1/move');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ newParentGuid: 'parent-2' });
      req.flush(null);
      await promise;
    });

    it('movePage bumps version on success', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));
      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [] });
      await settle();

      const promise = pages.movePage('g1', { newParentGuid: null });
      http.expectOne('/api/pages/g1/move').flush(null);
      await promise;
      await settle();

      // The resource should have refetched.
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'after-move' })] });
      await settle();
      expect(resource.value()?.[0].guid).toBe('after-move');
    });

    it('updatePage on a root page (folderId "") re-requests childrenResource(null)', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));
      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'before' })] });
      await settle();

      const promise = pages.updatePage('g1', { title: 'Renamed' });
      http.expectOne('/api/pages/g1').flush(pageContent({ guid: 'g1', folderId: '' }));
      await promise;
      await settle();

      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'after' })] });
      await settle();
      expect(resource.value()?.[0].guid).toBe('after');
    });

    it('deletePage sends DELETE with body', async () => {
      const promise = pages.deletePage('g1', { recursive: true });
      const req = http.expectOne('/api/pages/g1');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ recursive: true });
      req.flush(null);
      await promise;
    });

    it('reorderPages PUTs /api/pages/reorder', async () => {
      const promise = pages.reorderPages({ parentGuid: null, orderedGuids: ['a', 'b'] });
      const req = http.expectOne('/api/pages/reorder');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ parentGuid: null, orderedGuids: ['a', 'b'] });
      req.flush({ updated: 2 });
      await expect(promise).resolves.toEqual({ updated: 2 });
    });
  });

  describe('pageSearchResource', () => {
    it('GETs /api/pages/search with encoded query and trims whitespace', async () => {
      const q = signal<string | null>('  hello world  ');
      const resource = TestBed.runInInjectionContext(() => pages.pageSearchResource(q));
      await settle();
      const req = http.expectOne('/api/pages/search?q=hello%20world&limit=10');
      expect(req.request.method).toBe('GET');
      req.flush({ results: [{ guid: 'g1', title: 'Hello World', path: '/', folderId: null }] });
      await settle();
      expect(resource.value()?.[0].title).toBe('Hello World');
    });

    it('does not fetch when query is empty', async () => {
      const q = signal<string | null>('');
      TestBed.runInInjectionContext(() => pages.pageSearchResource(q));
      await settle();
      http.expectNone(() => true);
    });
  });

  describe('backlinksResource', () => {
    it('GETs /api/pages/{guid}/backlinks', async () => {
      const guid = signal<string | null>('p1');
      const resource = TestBed.runInInjectionContext(() => pages.backlinksResource(guid));
      await settle();
      const req = http.expectOne('/api/pages/p1/backlinks');
      req.flush({ guid: 'p1', backlinks: [{ guid: 'g2', title: 'Other' }], count: 1 });
      await settle();
      expect(resource.value()?.count).toBe(1);
      expect(resource.value()?.backlinks[0].title).toBe('Other');
    });

    it('re-requests after a createPage (link graph edges may have changed)', async () => {
      const guid = signal<string | null>('some-guid');
      const resource = TestBed.runInInjectionContext(() => pages.backlinksResource(guid));
      await settle();
      http
        .expectOne('/api/pages/some-guid/backlinks')
        .flush({ guid: 'some-guid', backlinks: [], count: 0 });
      await settle();

      const promise = pages.createPage({ title: 'Linker', parentGuid: null });
      http.expectOne('/api/pages').flush(pageContent({ guid: 'linker' }));
      await promise;
      await settle();

      http
        .expectOne('/api/pages/some-guid/backlinks')
        .flush({ guid: 'some-guid', backlinks: [{ guid: 'linker', title: 'Linker' }], count: 1 });
      await settle();
      expect(resource.value()?.count).toBe(1);
    });
  });

  describe('childrenWithPropertiesResource', () => {
    it('GETs /api/pages/{guid}/children?include=properties with no options', async () => {
      const parent = signal<string | null>('p1');
      const opts = signal<{ targetTypeGuid?: string; depth?: number; limit?: number; cursor?: string | null } | null>(null);
      const resource = TestBed.runInInjectionContext(() =>
        pages.childrenWithPropertiesResource(parent, opts),
      );
      await settle();
      const req = http.expectOne('/api/pages/p1/children?include=properties');
      expect(req.request.method).toBe('GET');
      req.flush({
        children: [
          { guid: 'c1', title: 'Card 1', parentGuid: 'p1', status: 'published',
            modifiedAt: '2026-01-01T00:00:00Z', modifiedBy: 'u', hasChildren: false,
            properties: { state: { type: 'string', value: 'To Do' } } },
        ],
        hasMore: false,
      });
      await settle();
      expect(resource.value()?.children?.[0]?.guid).toBe('c1');
    });

    it('passes type, depth, limit, cursor query params when options provided', async () => {
      const parent = signal<string | null>('p1');
      const opts = signal<{ targetTypeGuid?: string; depth?: number; limit?: number; cursor?: string | null } | null>({
        targetTypeGuid: 'pt-task', depth: 5, limit: 200, cursor: 'abc',
      });
      TestBed.runInInjectionContext(() => pages.childrenWithPropertiesResource(parent, opts));
      await settle();
      const req = http.expectOne(
        '/api/pages/p1/children?include=properties&type=pt-task&depth=5&limit=200&cursor=abc',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ children: [], hasMore: false });
      await settle();
    });

    it('does not fetch when parentGuid is null', async () => {
      const parent = signal<string | null>(null);
      const opts = signal<{ targetTypeGuid?: string; depth?: number; limit?: number; cursor?: string | null } | null>(null);
      TestBed.runInInjectionContext(() => pages.childrenWithPropertiesResource(parent, opts));
      await settle();
      http.expectNone(() => true);
    });

    it('reruns the loader when options signal changes', async () => {
      const parent = signal<string | null>('p1');
      const opts = signal<{ targetTypeGuid?: string; depth?: number; limit?: number; cursor?: string | null } | null>({
        limit: 200,
      });
      TestBed.runInInjectionContext(() => pages.childrenWithPropertiesResource(parent, opts));
      await settle();
      http.expectOne('/api/pages/p1/children?include=properties&limit=200').flush({ children: [], hasMore: false });
      await settle();

      opts.set({ targetTypeGuid: 'pt-x', depth: 3, limit: 200 });
      await settle();
      http.expectOne('/api/pages/p1/children?include=properties&type=pt-x&depth=3&limit=200').flush({
        children: [], hasMore: false,
      });
      await settle();
    });
  });

  describe('createPage mutation', () => {
    it('POSTs /api/pages with the request body', async () => {
      const promise = pages.createPage({ title: 'New', parentGuid: null });
      const req = http.expectOne('/api/pages');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ title: 'New', parentGuid: null });
      req.flush(pageContent({ guid: 'new', title: 'New' }));
      const result = await promise;
      expect(result.guid).toBe('new');
    });
  });

  describe('rejects-of-rxjs sanity', () => {
    // Sanity check that we aren't accidentally consuming the rxjs symbol export
    it('importable smoke', () => {
      void firstValueFrom(of(1));
    });
  });
});
