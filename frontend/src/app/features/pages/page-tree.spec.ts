import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { PageTree } from './page-tree';
import { PageTreeItem } from './page-tree-item';
import { Pages } from './pages';
import type { PageTypeDefinition } from './page.types';

const providers = [provideHttpClient(), provideHttpClientTesting()];

describe('PageTree', () => {
  it('shows a loading indicator on first render', async () => {
    await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.verify();
  });

  it('shows the empty state when there are no pages', async () => {
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(screen.getByText(/no pages yet/i)).toBeInTheDocument();
    http.verify();
  });

  it('renders root pages returned by the resource', async () => {
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({
      children: [
        { guid: 'a', title: 'Alpha', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
        { guid: 'b', title: 'Beta', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
      ],
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    http.verify();
  });

  it('bubbles pageSelect from a child item', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance.pageSelect.subscribe((g: string) => events.push(g));
    http.expectOne('/api/pages/root/children').flush({
      children: [
        { guid: 'a', title: 'Alpha', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
      ],
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    await user.click(screen.getByText('Alpha'));
    expect(events).toEqual(['a']);
    http.verify();
  });

  it('bubbles dropRequested (step 2.1 positional drop) from a child item', async () => {
    const events: unknown[] = [];
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance.dropRequested.subscribe((e: unknown) => events.push(e));
    http.expectOne('/api/pages/root/children').flush({
      children: [
        { guid: 'a', title: 'Alpha', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
      ],
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();

    const item = fixture.debugElement
      .query(By.directive(PageTreeItem)).componentInstance as PageTreeItem;
    const payload = {
      movingGuid: 'm', movingParentGuid: null, targetGuid: 'a', targetParentGuid: null, zone: 'before' as const,
      movingPage: {
        guid: 'm', title: 'M', parentGuid: null, status: 'published' as const,
        modifiedAt: '', modifiedBy: '', hasChildren: false,
      },
      targetParentType: null,
    };
    item.dropRequested.emit(payload);

    expect(events).toEqual([payload]);
    http.verify();
  });

  // ---- Final review #1: the NESTED (depth >= 1) forwarding seam -------------
  //
  // The tests above query `By.directive(PageTreeItem)`, which returns the FIRST
  // (root-level) item — so the recursive PageTreeItem -> PageTreeItem hop had no
  // coverage, and a missing `(dropRequested)` binding there shipped: every
  // before/after drop on a child row rendered an insertion line and then went
  // nowhere. These tests drive the same outputs from the *nested* item.

  async function flush(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }

  const page = (over: Record<string, unknown>) => ({
    guid: 'g', title: 'T', parentGuid: null, status: 'published',
    modifiedAt: '', modifiedBy: '', hasChildren: false, ...over,
  });

  /** Render the tree, expand the single root parent, and return its child item. */
  async function renderNestedItem() {
    const user = userEvent.setup();
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({
      children: [page({ guid: 'p1', title: 'Parent', hasChildren: true })],
    });
    await flush();
    fixture.detectChanges();

    await user.click(screen.getByRole('button', { name: /expand/i }));
    await flush();
    fixture.detectChanges();
    http.expectOne('/api/pages/p1/children').flush({
      children: [page({ guid: 'c1', title: 'Child', parentGuid: 'p1', hasChildren: true })],
    });
    await flush();
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.directive(PageTreeItem));
    expect(items).toHaveLength(2); // [0] = root-level parent, [1] = nested child
    expect(screen.getByText('Child')).toBeInTheDocument();
    return { fixture, http, nested: items[1].componentInstance as PageTreeItem };
  }

  it('bubbles dropRequested from a NESTED (depth 1) tree item', async () => {
    const events: unknown[] = [];
    const { fixture, http, nested } = await renderNestedItem();
    fixture.componentInstance.dropRequested.subscribe((e: unknown) => events.push(e));

    const payload = {
      movingGuid: 'm', movingParentGuid: 'p1', targetGuid: 'c1', targetParentGuid: 'p1',
      zone: 'after' as const,
      movingPage: page({ guid: 'm', parentGuid: 'p1' }) as never,
      targetParentType: null,
    };
    nested.dropRequested.emit(payload);

    expect(events).toEqual([payload]);
    http.match(() => true).forEach((r) => r.flush({ children: [] }));
  });

  it('bubbles every other forwarded output from a NESTED tree item', async () => {
    /** Minimal structural view of an Angular `output()` — payload type erased. */
    type ErasedOutputs = Record<string, {
      emit(value: unknown): void;
      subscribe(next: (value: unknown) => void): unknown;
    }>;

    const cases: { name: string; payload: unknown }[] = [
      { name: 'pageSelect', payload: 'c1' },
      { name: 'renameRequested', payload: { guid: 'c1', title: 'Child' } },
      // The {guid, hasChildren} delete payload (step 2.8) at the nested level.
      { name: 'deleteRequested', payload: { guid: 'c1', hasChildren: true } },
      { name: 'newChildRequested', payload: 'c1' },
      { name: 'sortRequested', payload: { guid: 'c1', direction: 'asc' } },
      { name: 'moveRequested', payload: 'c1' },
    ];

    const { fixture, http, nested } = await renderNestedItem();
    const treeOutputs = fixture.componentInstance as unknown as ErasedOutputs;
    const nestedOutputs = nested as unknown as ErasedOutputs;

    for (const { name, payload } of cases) {
      const events: unknown[] = [];
      treeOutputs[name].subscribe((e) => events.push(e));
      nestedOutputs[name].emit(payload);
      expect(events).toEqual([payload]);
    }

    http.match(() => true).forEach((r) => r.flush({ children: [] }));
  });

  it('forwards expandGuid down to a NESTED tree item', async () => {
    const { fixture, http, nested } = await renderNestedItem();

    fixture.componentRef.setInput('expandGuid', { guid: 'c1', nonce: 7 });
    await flush();
    fixture.detectChanges();

    expect(nested.expandGuid()).toEqual({ guid: 'c1', nonce: 7 });
    expect(nested.expanded()).toBe(true);

    await flush();
    fixture.detectChanges();
    http.match(() => true).forEach((r) => r.flush({ children: [] }));
  });

  // ---- Final review #4: the root drop zone enforces type constraints --------
  //
  // `onRootDrop` had neither an enterPredicate nor an on-drop check, so a page
  // whose type restricts its parents could be silently reparented to the root.

  function typeDef(over: Partial<PageTypeDefinition>): PageTypeDefinition {
    return {
      guid: 'guid', name: 'Name', icon: '📦', properties: [],
      allowedChildTypes: [], allowWikiPageChildren: true,
      allowedParentTypes: [], allowAnyParent: true,
      createdBy: 'u', createdAt: '', updatedAt: '',
      ...over,
    };
  }

  const rootTypeMap = (): Record<string, PageTypeDefinition> => ({
    // An Episode must live under a Season — never at the root.
    episode: typeDef({ guid: 'episode', name: 'Episode', allowedParentTypes: ['season'], allowAnyParent: false }),
    // A Season may sit anywhere.
    season: typeDef({ guid: 'season', name: 'Season' }),
  });

  function rootDropEvent(dragged: Record<string, unknown>) {
    return { item: { data: page(dragged) } } as unknown as Parameters<PageTree['onRootDrop']>[0];
  }

  async function renderEmptyTree(pageTypesMap: Record<string, PageTypeDefinition> = {}) {
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap } });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('a root drop of a page whose type forbids a root parent alerts and does NOT movePage', async () => {
    const { fixture, http } = await renderEmptyTree(rootTypeMap());
    const moveSpy = jest.spyOn(TestBed.inject(Pages), 'movePage').mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);

    await fixture.componentInstance.onRootDrop(
      rootDropEvent({ guid: 'e1', parentGuid: 'the-season', pageType: 'episode' }),
    );

    expect(alertSpy).toHaveBeenCalledWith('Cannot move here:\nEpisode cannot be placed under an untyped wiki page');
    expect(moveSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    http.verify();
  });

  it('a root drop of an unconstrained page still reparents to the root', async () => {
    const { fixture, http } = await renderEmptyTree(rootTypeMap());
    const moveSpy = jest.spyOn(TestBed.inject(Pages), 'movePage').mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);

    await fixture.componentInstance.onRootDrop(
      rootDropEvent({ guid: 's1', parentGuid: 'somewhere', pageType: 'season' }),
    );

    expect(alertSpy).not.toHaveBeenCalled();
    expect(moveSpy).toHaveBeenCalledWith('s1', { newParentGuid: null });

    alertSpy.mockRestore();
    http.verify();
  });

  it('a root drop of an untyped page is unaffected', async () => {
    const { fixture, http } = await renderEmptyTree(rootTypeMap());
    const moveSpy = jest.spyOn(TestBed.inject(Pages), 'movePage').mockResolvedValue(undefined);

    await fixture.componentInstance.onRootDrop(rootDropEvent({ guid: 'u1', parentGuid: 'somewhere' }));

    expect(moveSpy).toHaveBeenCalledWith('u1', { newParentGuid: null });
    http.verify();
  });

  it('a root drop of an already-root page stays a no-op', async () => {
    const { fixture, http } = await renderEmptyTree(rootTypeMap());
    const moveSpy = jest.spyOn(TestBed.inject(Pages), 'movePage').mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);

    await fixture.componentInstance.onRootDrop(rootDropEvent({ guid: 'e1', parentGuid: null, pageType: 'episode' }));

    expect(moveSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    http.verify();
  });
});
