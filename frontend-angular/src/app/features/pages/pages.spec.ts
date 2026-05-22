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

    it('reruns after bumpVersion()', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));

      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'v1' })] });
      await settle();

      pages.bumpVersion();
      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'v2' })] });
      await settle();

      expect(resource.value()?.[0].guid).toBe('v2');
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
