import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { PageTypes, SKIP_PAGE_TYPE_FETCH } from './page-types';
import type { PageTypeDefinition } from '../pages/page.types';

function pageType(over: Partial<PageTypeDefinition> = {}): PageTypeDefinition {
  return {
    guid: 'pt-1',
    name: 'Article',
    icon: 'article',
    properties: [],
    allowedChildTypes: [],
    allowWikiPageChildren: true,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('PageTypes service', () => {
  let http: HttpTestingController;
  let pageTypes: PageTypes;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PageTypes],
    });
    http = TestBed.inject(HttpTestingController);
    pageTypes = TestBed.inject(PageTypes);
  });

  afterEach(() => http.verify());

  describe('pageTypesResource', () => {
    it('GETs /api/page-types and unwraps pageTypes array', async () => {
      const resource = TestBed.runInInjectionContext(() => pageTypes.pageTypesResource());
      await settle();
      const req = http.expectOne('/api/page-types');
      expect(req.request.method).toBe('GET');
      req.flush({ pageTypes: [pageType({ guid: 'a' }), pageType({ guid: 'b' })] });
      await settle();
      expect(resource.value()?.length).toBe(2);
      expect(resource.value()?.[0].guid).toBe('a');
    });

    it('refetches after bumpVersion()', async () => {
      const resource = TestBed.runInInjectionContext(() => pageTypes.pageTypesResource());
      await settle();
      http.expectOne('/api/page-types').flush({ pageTypes: [pageType({ guid: 'v1' })] });
      await settle();

      pageTypes.bumpVersion();
      await settle();
      http.expectOne('/api/page-types').flush({ pageTypes: [pageType({ guid: 'v2' })] });
      await settle();

      expect(resource.value()?.[0].guid).toBe('v2');
    });
  });

  describe('pageTypeResource', () => {
    it('GETs /api/page-types/{guid}', async () => {
      const guid = signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>('pt-7');
      const resource = TestBed.runInInjectionContext(() => pageTypes.pageTypeResource(guid));
      await settle();
      http.expectOne('/api/page-types/pt-7').flush(pageType({ guid: 'pt-7', name: 'Note' }));
      await settle();
      expect(resource.value()?.name).toBe('Note');
    });

    it('skips fetch when guid is null', async () => {
      const guid = signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>(null);
      TestBed.runInInjectionContext(() => pageTypes.pageTypeResource(guid));
      await settle();
      http.expectNone(() => true);
    });

    it('skips fetch when guid is SKIP sentinel', async () => {
      const guid = signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>(SKIP_PAGE_TYPE_FETCH);
      TestBed.runInInjectionContext(() => pageTypes.pageTypeResource(guid));
      await settle();
      http.expectNone(() => true);
    });
  });

  describe('allowedChildTypesResource', () => {
    it('GETs /api/page-types/{guid}/allowed-children', async () => {
      const parent = signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>('pt-parent');
      const resource = TestBed.runInInjectionContext(() =>
        pageTypes.allowedChildTypesResource(parent),
      );
      await settle();
      const req = http.expectOne('/api/page-types/pt-parent/allowed-children');
      expect(req.request.method).toBe('GET');
      req.flush({ allowedChildTypes: [pageType({ guid: 'c1' })], allowWikiPageChildren: false });
      await settle();
      expect(resource.value()?.allowedChildTypes.length).toBe(1);
      expect(resource.value()?.allowWikiPageChildren).toBe(false);
    });

    it('reruns when parent signal changes', async () => {
      const parent = signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>('pt-a');
      const resource = TestBed.runInInjectionContext(() =>
        pageTypes.allowedChildTypesResource(parent),
      );
      await settle();
      http.expectOne('/api/page-types/pt-a/allowed-children').flush({
        allowedChildTypes: [pageType({ guid: 'aa' })],
        allowWikiPageChildren: true,
      });
      await settle();

      parent.set('pt-b');
      await settle();
      http.expectOne('/api/page-types/pt-b/allowed-children').flush({
        allowedChildTypes: [pageType({ guid: 'bb' })],
        allowWikiPageChildren: false,
      });
      await settle();

      expect(resource.value()?.allowedChildTypes[0].guid).toBe('bb');
    });
  });
});
