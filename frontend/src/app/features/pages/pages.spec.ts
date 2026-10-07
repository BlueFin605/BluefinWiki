import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { Pages, SKIP_CHILDREN_FETCH } from './pages';
import { InvalidationBus, pageTagsListTag } from '../../core/api/invalidation';
import { PageUpserts, type PageUpsertBatch } from '../../core/realtime/page-upserts';
import type { PageContent, PageSummary, PageUpsert } from './page.types';

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

  describe('fetchPage', () => {
    it('GETs /api/pages/{guid} imperatively and returns the full record', async () => {
      const promise = pages.fetchPage('parent-1');
      const req = http.expectOne('/api/pages/parent-1');
      expect(req.request.method).toBe('GET');
      req.flush(pageContent({
        guid: 'parent-1',
        pageType: 'pt-1',
        properties: { status: { type: 'string', value: 'in-progress' } },
      }));
      const result = await promise;
      expect(result.pageType).toBe('pt-1');
      expect(result.properties).toEqual({ status: { type: 'string', value: 'in-progress' } });
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

    it('updatePage with tags in the body bumps the page-tags vocabulary', async () => {
      const bus = TestBed.inject(InvalidationBus);
      const before = bus.version(pageTagsListTag());

      const promise = pages.updatePage('g1', { tags: ['foo', 'bar'] });
      http.expectOne('/api/pages/g1').flush(pageContent({ guid: 'g1' }));
      await promise;

      expect(bus.version(pageTagsListTag())).toBe(before + 1);
    });

    it('updatePage without tags leaves the page-tags vocabulary untouched', async () => {
      const bus = TestBed.inject(InvalidationBus);
      const before = bus.version(pageTagsListTag());

      const promise = pages.updatePage('g1', { title: 'New' });
      http.expectOne('/api/pages/g1').flush(pageContent({ guid: 'g1' }));
      await promise;

      expect(bus.version(pageTagsListTag())).toBe(before);
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

    it('updatePage with a title change patches a descendant ancestorsResource in place (folder rename)', async () => {
      const descendant = signal<string | null>('descendant-guid');
      const resource = TestBed.runInInjectionContext(() => pages.ancestorsResource(descendant));
      await settle();
      http
        .expectOne('/api/pages/descendant-guid/ancestors')
        .flush({ ancestors: [summary({ guid: 'folder', title: 'Old Folder' })] });
      await settle();

      const promise = pages.updatePage('folder', { title: 'New Folder' });
      http.expectOne('/api/pages/folder').flush(pageContent({ guid: 'folder', title: 'New Folder', modifiedAt: '2026-02-01T00:00:00Z' }));
      await promise;
      await settle();

      http.expectNone('/api/pages/descendant-guid/ancestors');
      expect(resource.value()?.[0].title).toBe('New Folder');
    });

    it('movePage re-requests a descendant ancestorsResource', async () => {
      const descendant = signal<string | null>('descendant-guid');
      const resource = TestBed.runInInjectionContext(() => pages.ancestorsResource(descendant));
      await settle();
      http
        .expectOne('/api/pages/descendant-guid/ancestors')
        .flush({ ancestors: [summary({ guid: 'folder' })] });
      await settle();

      const promise = pages.movePage('folder', { newParentGuid: 'new-parent' });
      http.expectOne('/api/pages/folder/move').flush(null);
      await promise;
      await settle();

      http
        .expectOne('/api/pages/descendant-guid/ancestors')
        .flush({ ancestors: [summary({ guid: 'after' })] });
      await settle();
      expect(resource.value()?.[0].guid).toBe('after');
    });

    it('updatePage of a visible page emits a local upsert and bumps only page-level tags', async () => {
      const bus = TestBed.inject(InvalidationBus);
      const seen: PageUpsertBatch[] = [];
      TestBed.inject(PageUpserts).batches$.subscribe((b) => seen.push(b));
      const before = {
        any: bus.version('children:any'),
        mid: bus.version('children:mid-guid'),
        anc: bus.version('ancestors:any'),
        page: bus.version('page:card'),
      };

      const promise = pages.updatePage('card', { title: 'Card 2', properties: { state: { type: 'string', value: 'Done' } } });
      http.expectOne('/api/pages/card').flush(
        pageContent({
          guid: 'card', title: 'Card 2', folderId: 'mid-guid', content: '# secret', tags: [],
          properties: { state: { type: 'string', value: 'Done' } }, boardOrder: 3, pageType: 'pt-task',
        }),
      );
      await promise;

      expect(seen).toEqual([
        {
          source: 'local',
          pages: [
            {
              guid: 'card', title: 'Card 2', parentGuid: 'mid-guid', status: 'published', boardOrder: 3, pageType: 'pt-task',
              properties: { state: { type: 'string', value: 'Done' } },
              createdBy: 'u', modifiedAt: '2026-01-01T00:00:00Z', modifiedBy: 'u',
            },
          ],
        },
      ]);
      expect(bus.version('children:any')).toBe(before.any);
      expect(bus.version('children:mid-guid')).toBe(before.mid);
      expect(bus.version('ancestors:any')).toBe(before.anc);
      expect(bus.version('page:card')).toBe(before.page + 1);
    });

    it.each(['draft', 'archived'] as const)('updatePage returning a %s page keeps the coarse tags and emits nothing', async (status) => {
      const bus = TestBed.inject(InvalidationBus);
      const seen: PageUpsertBatch[] = [];
      TestBed.inject(PageUpserts).batches$.subscribe((b) => seen.push(b));
      const before = { any: bus.version('children:any'), anc: bus.version('ancestors:any') };

      const promise = pages.updatePage('g1', { title: 'T', status });
      http.expectOne('/api/pages/g1').flush(pageContent({ guid: 'g1', status }));
      await promise;

      expect(seen).toEqual([]);
      expect(bus.version('children:any')).toBe(before.any + 1);
      expect(bus.version('ancestors:any')).toBe(before.anc + 1);
    });

    it('updatePage on a root page (folderId "") patches childrenResource(null) in place', async () => {
      const parent = signal<string | null>(null);
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(parent));
      await settle();
      http.expectOne('/api/pages/root/children').flush({ children: [summary({ guid: 'g1', title: 'Before', hasChildren: true })] });
      await settle();

      const promise = pages.updatePage('g1', { title: 'Renamed' });
      http.expectOne('/api/pages/g1').flush(pageContent({ guid: 'g1', title: 'Renamed', folderId: '', modifiedAt: '2026-02-01T00:00:00Z' }));
      await promise;
      await settle();

      http.expectNone('/api/pages/root/children');
      expect(resource.value()?.[0]).toMatchObject({ guid: 'g1', title: 'Renamed', parentGuid: null, hasChildren: true });
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

  describe('resolveLink', () => {
    it('POSTs /api/pages/links/resolve and returns the exact match guid + exists', async () => {
      const promise = pages.resolveLink('Getting Started');
      const req = http.expectOne('/api/pages/links/resolve');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ query: 'Getting Started', maxResults: 1 });
      req.flush({
        query: 'Getting Started',
        matches: [{ guid: 'g-123', title: 'Getting Started', parentGuid: null, status: 'published', confidence: 1, path: 'Getting Started' }],
        exactMatch: true,
        ambiguous: false,
        exists: true,
      });
      await expect(promise).resolves.toEqual({ guid: 'g-123', exists: true });
    });

    it('reports exists:false (and echoes the target as guid) when there is no exact match', async () => {
      const promise = pages.resolveLink('Ghost');
      http.expectOne('/api/pages/links/resolve').flush({
        query: 'Ghost',
        matches: [{ guid: 'fuzzy', title: 'Ghostly', parentGuid: null, status: 'published', confidence: 0.6, path: 'Ghostly' }],
        exactMatch: false,
        ambiguous: false,
        exists: true,
      });
      await expect(promise).resolves.toEqual({ guid: 'Ghost', exists: false });
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
      const opts = signal<{ targetTypeGuids?: string[]; depth?: number; limit?: number; cursor?: string | null } | null>(null);
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

    it('joins multiple card types into a comma-separated type param', async () => {
      const parent = signal<string | null>('p1');
      const opts = signal<{ targetTypeGuids?: string[]; depth?: number; limit?: number; cursor?: string | null } | null>({
        targetTypeGuids: ['pt-task', 'pt-bug'], depth: 5, limit: 200,
      });
      TestBed.runInInjectionContext(() => pages.childrenWithPropertiesResource(parent, opts));
      await settle();
      const req = http.expectOne(
        '/api/pages/p1/children?include=properties&type=pt-task%2Cpt-bug&depth=5&limit=200',
      );
      req.flush({ children: [], hasMore: false });
      await settle();
    });

    it('passes type, depth, limit, cursor query params when options provided', async () => {
      const parent = signal<string | null>('p1');
      const opts = signal<{ targetTypeGuids?: string[]; depth?: number; limit?: number; cursor?: string | null } | null>({
        targetTypeGuids: ['pt-task'], depth: 5, limit: 200, cursor: 'abc',
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
      const opts = signal<{ targetTypeGuids?: string[]; depth?: number; limit?: number; cursor?: string | null } | null>(null);
      TestBed.runInInjectionContext(() => pages.childrenWithPropertiesResource(parent, opts));
      await settle();
      http.expectNone(() => true);
    });

    it('reruns the loader when options signal changes', async () => {
      const parent = signal<string | null>('p1');
      const opts = signal<{ targetTypeGuids?: string[]; depth?: number; limit?: number; cursor?: string | null } | null>({
        limit: 200,
      });
      TestBed.runInInjectionContext(() => pages.childrenWithPropertiesResource(parent, opts));
      await settle();
      http.expectOne('/api/pages/p1/children?include=properties&limit=200').flush({ children: [], hasMore: false });
      await settle();

      opts.set({ targetTypeGuids: ['pt-x'], depth: 3, limit: 200 });
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

    it('createPage with tags in the body bumps the page-tags vocabulary', async () => {
      const bus = TestBed.inject(InvalidationBus);
      const before = bus.version(pageTagsListTag());

      const promise = pages.createPage({
        title: 'New',
        parentGuid: null,
        tags: ['foo', 'bar'],
      });
      http.expectOne('/api/pages').flush(pageContent({ guid: 'new' }));
      await promise;

      expect(bus.version(pageTagsListTag())).toBe(before + 1);
    });

    it('createPage without tags leaves the page-tags vocabulary untouched', async () => {
      const bus = TestBed.inject(InvalidationBus);
      const before = bus.version(pageTagsListTag());

      const promise = pages.createPage({ title: 'New', parentGuid: null });
      http.expectOne('/api/pages').flush(pageContent({ guid: 'new' }));
      await promise;

      expect(bus.version(pageTagsListTag())).toBe(before);
    });
  });

  describe('rejects-of-rxjs sanity', () => {
    // Sanity check that we aren't accidentally consuming the rxjs symbol export
    it('importable smoke', () => {
      void firstValueFrom(of(1));
    });
  });

  describe('upserts', () => {
    function upsert(over: Partial<PageUpsert> = {}): PageUpsert {
      return {
        guid: 'g',
        title: 'T',
        parentGuid: 'p',
        status: 'published',
        modifiedAt: '2026-02-01T00:00:00Z',
        modifiedBy: 'u',
        ...over,
      };
    }
    const emit = async (...ps: PageUpsert[]) => {
      TestBed.inject(PageUpserts).emit(ps, 'remote');
      await settle();
    };

    async function loadedChildren(parentGuid: string | null, rows: PageSummary[]) {
      const resource = TestBed.runInInjectionContext(() => pages.childrenResource(signal(parentGuid)));
      await settle();
      http.expectOne(`/api/pages/${parentGuid ?? 'root'}/children`).flush({ children: rows });
      await settle();
      return resource;
    }

    it('childrenResource renames a visible row in place, keeping hasChildren, with no HTTP', async () => {
      const resource = await loadedChildren('p', [
        summary({ guid: 'a', title: 'Alpha', parentGuid: 'p', sortOrder: 1, hasChildren: true }),
        summary({ guid: 'b', title: 'Beta', parentGuid: 'p', sortOrder: 2 }),
      ]);

      await emit(upsert({ guid: 'a', title: 'Alpha 2', sortOrder: 1 }));

      http.expectNone(() => true);
      expect(resource.hasValue()).toBe(true);
      expect(resource.value()?.[0]).toMatchObject({ guid: 'a', title: 'Alpha 2', hasChildren: true });
    });

    it('childrenResource re-sorts by sortOrder after a patch', async () => {
      const resource = await loadedChildren(null, [
        summary({ guid: 'a', title: 'A', sortOrder: 1 }),
        summary({ guid: 'b', title: 'B', sortOrder: 2 }),
        summary({ guid: 'c', title: 'C' }),
      ]);
      await emit(upsert({ guid: 'a', title: 'A', parentGuid: null, sortOrder: 3 }));
      expect(resource.value()?.map((r) => r.guid)).toEqual(['b', 'a', 'c']);
    });

    it('childrenResource refetches once when a new child appears under the loaded parent', async () => {
      const resource = await loadedChildren('p', [summary({ guid: 'a', parentGuid: 'p' })]);
      await emit(upsert({ guid: 'new', parentGuid: 'p' }));
      http.expectOne('/api/pages/p/children').flush({ children: [summary({ guid: 'a' }), summary({ guid: 'new' })] });
      await settle();
      expect(resource.value()?.map((r) => r.guid)).toEqual(['a', 'new']);
    });

    it('childrenResource ignores pages of other parents and older upserts', async () => {
      const row = summary({ guid: 'a', title: 'Keep', parentGuid: 'p', modifiedAt: '2026-03-01T00:00:00Z' });
      const resource = await loadedChildren('p', [row]);
      await emit(upsert({ guid: 'x', parentGuid: 'other' }), upsert({ guid: 'a', title: 'Old' }));
      expect(resource.value()).toEqual([row]);
    });

    it('childrenResource ignores upserts while collapsed (fetch skipped)', async () => {
      TestBed.runInInjectionContext(() => pages.childrenResource(signal<string | null | typeof SKIP_CHILDREN_FETCH>(SKIP_CHILDREN_FETCH)));
      await settle();
      await emit(upsert({ guid: 'a' }));
      http.expectNone(() => true);
    });

    it('ancestorsResource patches a renamed ancestor title with no HTTP', async () => {
      const resource = TestBed.runInInjectionContext(() => pages.ancestorsResource(signal('leaf')));
      await settle();
      http.expectOne('/api/pages/leaf/ancestors').flush({
        ancestors: [summary({ guid: 'root', title: 'Root' }), summary({ guid: 'mid', title: 'Mid', parentGuid: 'root' })],
      });
      await settle();

      await emit(upsert({ guid: 'mid', title: 'Middle', parentGuid: 'root' }), upsert({ guid: 'x', title: 'X' }));

      http.expectNone(() => true);
      expect(resource.hasValue()).toBe(true);
      expect(resource.value()?.map((a) => a.title)).toEqual(['Root', 'Middle']);
    });
  });
});
