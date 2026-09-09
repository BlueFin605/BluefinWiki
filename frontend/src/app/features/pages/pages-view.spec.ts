jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), render: jest.fn() },
}));

import type { DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSidenav } from '@angular/material/sidenav';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { Layout } from '../../core/layout/layout';
import { PagesView } from './pages-view';
import { Pages } from './pages';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { PageContext } from './page-context';
import { PageTree } from './page-tree';
import { ResizeDivider } from '../../shared/components/resize-divider';
import { SearchDialog } from '../search/search-dialog';
import { provideBreakpointStub } from '../../testing/breakpoint-stub';
import type { PageTypeDefinition } from './page.types';
import type { PageMetadata } from './drafts';
import type { PageTypeChange } from '../editor/page-properties-panel';

function makeMeta(over: Partial<PageMetadata> = {}): PageMetadata {
  return {
    title: 'T', tags: [], status: 'published',
    createdBy: 'author-1', modifiedBy: 'u', createdAt: '', modifiedAt: '', guid: 'g1',
    ...over,
  };
}

function makeType(over: Partial<PageTypeDefinition>): PageTypeDefinition {
  return {
    guid: 'g', name: 'N', icon: '📦', properties: [],
    allowedChildTypes: [], allowWikiPageChildren: true,
    allowedParentTypes: [], allowAnyParent: true,
    createdBy: 'u', createdAt: '', updatedAt: '',
    ...over,
  };
}

// Captured per `baseProviders()` call so a test can flip `bpStub.isDesktop`
// after the component is rendered (DI hands PagesView these exact signals).
let bpStub: ReturnType<typeof provideBreakpointStub>;

function baseProviders() {
  bpStub = provideBreakpointStub();
  return [
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
    // DESIGN.md 1b: Breakpoint is mocked per spec. PagesView pulls it in via
    // PageContext and reads it directly for the responsive shell; default the
    // stub to desktop.
    ...bpStub.providers,
  ];
}

function authProviders(role: 'Admin' | 'Standard') {
  return [
    {
      provide: Auth,
      useValue: {
        user: () => ({
          userId: 'u',
          email: 'a@b',
          displayName: 'A',
          role,
          emailVerified: true,
        }),
        signOut: jest.fn(),
      },
    },
  ];
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('PagesView', () => {
  it('renders the header and a sidebar containing the page tree', async () => {
    await render(PagesView, { providers: [...baseProviders(), ...authProviders('Admin')] });
    expect(screen.getByText(/bluefinwiki/i)).toBeInTheDocument();
    // The page tree renders its loading state on first mount.
    expect(screen.getByText(/loading pages/i)).toBeInTheDocument();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
  });

  it('renders an enabled New page button (Phase 4 opens NewPageModal)', async () => {
    await render(PagesView, { providers: [...baseProviders(), ...authProviders('Admin')] });
    const newBtn = screen.getByRole('button', { name: /new page/i });
    expect(newBtn).not.toBeDisabled();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
  });

  it('opens a user menu showing Settings for admins', async () => {
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Admin')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /user menu/i }));
    await settle();
    fixture.detectChanges();

    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('hides the Settings menu item for standard users', async () => {
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Standard')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /user menu/i }));
    await settle();
    fixture.detectChanges();

    expect(screen.queryByRole('menuitem', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
  });

  it('opens the SearchDialog when Ctrl+K is pressed', async () => {
    await render(PagesView, { providers: [...baseProviders(), ...authProviders('Admin')] });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = jest
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => ({ subscribe: () => undefined }) } as never);

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    window.dispatchEvent(event);
    await settle();

    expect(openSpy).toHaveBeenCalledWith(SearchDialog, expect.any(Object));
  });

  it('does NOT open the SearchDialog for Ctrl+K originating inside a .cm-editor', async () => {
    await render(PagesView, { providers: [...baseProviders(), ...authProviders('Admin')] });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = jest
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => ({ subscribe: () => undefined }) } as never);

    const cm = document.createElement('div');
    cm.className = 'cm-editor';
    const inner = document.createElement('div');
    cm.appendChild(inner);
    document.body.appendChild(cm);
    try {
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
      inner.dispatchEvent(event);
      await settle();
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      document.body.removeChild(cm);
    }
  });

  it('does NOT open the SearchDialog for a Ctrl+K whose default was already prevented', async () => {
    await render(PagesView, { providers: [...baseProviders(), ...authProviders('Admin')] });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = jest
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => ({ subscribe: () => undefined }) } as never);

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    await settle();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('toggles the AI sidebar when the AI button is clicked', async () => {
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Admin')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();
    fixture.detectChanges();

    // Initially the AI panel is closed.
    expect(screen.queryByRole('complementary', { name: /ai assistant/i })).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /open ai assistant/i }));
    await settle();
    fixture.detectChanges();

    expect(screen.getByRole('complementary', { name: /ai assistant/i })).toBeInTheDocument();
  });

  it('opens the SearchDialog when Cmd+K is pressed', async () => {
    await render(PagesView, { providers: [...baseProviders(), ...authProviders('Admin')] });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = jest
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => ({ subscribe: () => undefined }) } as never);

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    window.dispatchEvent(event);
    await settle();

    expect(openSpy).toHaveBeenCalledWith(SearchDialog, expect.any(Object));
  });

  it('feeds the PageTree a page-types map keyed by type guid (not an empty map)', async () => {
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Admin')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({
      pageTypes: [
        makeType({ guid: 'pt-recipe', name: 'Recipe', icon: '🍲' }),
        makeType({ guid: 'pt-tv', name: 'TV Show', icon: '📺' }),
      ],
    });
    await settle();

    const tree = fixture.debugElement.query(By.directive(PageTree))
      .componentInstance as PageTree;
    const map = tree.pageTypesMap();
    expect(Object.keys(map).sort()).toEqual(['pt-recipe', 'pt-tv']);
    expect(map['pt-recipe'].name).toBe('Recipe');
    expect(map['pt-tv'].icon).toBe('📺');
  });

  it('resizes the tree column via the resize divider, clamped through the layout store', async () => {
    localStorage.clear();
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Admin')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();

    const layout = TestBed.inject(Layout);
    const updateSpy = jest.spyOn(layout, 'update');

    const divider = fixture.debugElement.query(By.directive(ResizeDivider))
      .componentInstance as ResizeDivider;
    // jsdom getBoundingClientRect() is all-zero, so the emitted pointer X maps
    // 1:1 to a candidate width; 50 is below the 200 floor.
    divider.resized.emit(50);
    await settle();
    fixture.detectChanges();

    // jsdom rects are all-zero, so the raw candidate width is the pointer X;
    // the store clamps it up to the 200 floor.
    expect(updateSpy).toHaveBeenCalledWith({ treeWidth: 50 });
    expect(layout.treeWidth()).toBe(200);

    const host = fixture.nativeElement as HTMLElement;
    const sidebar = host.querySelector('.sidebar') as HTMLElement;
    expect(sidebar.style.width).toBe('200px');
  });

  it('maps the divider pointer X to a width relative to the shell left edge', async () => {
    localStorage.clear();
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Admin')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();

    const layout = TestBed.inject(Layout);
    const host = fixture.nativeElement as HTMLElement;
    const body = host.querySelector('.body') as HTMLElement;
    jest
      .spyOn(body, 'getBoundingClientRect')
      .mockReturnValue({ left: 100, right: 1000, top: 0, bottom: 0, width: 900, height: 0, x: 100, y: 0, toJSON: () => ({}) });

    const divider = fixture.debugElement.query(By.directive(ResizeDivider))
      .componentInstance as ResizeDivider;
    divider.resized.emit(450); // 450 - 100 = 350, within 200-600
    await settle();

    expect(layout.treeWidth()).toBe(350);
  });

  it('renders the page-type emoji for a typed page once the map is populated', async () => {
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Admin')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({
      children: [
        {
          guid: 'p1', title: 'Carbonara', parentGuid: null, status: 'published',
          modifiedAt: '2026-01-01', modifiedBy: 'u', hasChildren: false,
          pageType: 'pt-recipe',
        },
      ],
    });
    http.expectOne('/api/page-types').flush({
      pageTypes: [makeType({ guid: 'pt-recipe', name: 'Recipe', icon: '🍲' })],
    });
    await settle();
    fixture.detectChanges();

    const icon = screen.getByTitle('Recipe');
    expect(icon).toHaveTextContent('🍲');
  });

  // ---- Step 1b.3: hoisted inspector fed by PageContext -------------------

  async function renderShell() {
    const result = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Admin')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();
    return { ...result, http };
  }

  it('does NOT render the inspector while PageContext has no page', async () => {
    const { fixture } = await renderShell();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-inspector-panel')).toBeNull();
  });

  it('renders the hoisted wiki-inspector-panel once PageContext has a guid + metadata (and the inspector is open)', async () => {
    const { fixture, http } = await renderShell();
    const ctx = TestBed.inject(PageContext);

    ctx.guid.set('g1');
    ctx.metadata.set(makeMeta());
    TestBed.inject(Layout).update({ inspectorVisible: true }); // I8 gate: panel mounts only while inspectorOpened()
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('wiki-inspector-panel');
    expect(panel).toBeTruthy();
    // Bound straight from PageContext.
    const inst = fixture.debugElement.query(By.css('wiki-inspector-panel')).componentInstance as {
      pageGuid: () => string;
      metadata: () => PageMetadata;
      canInsert: () => boolean;
    };
    expect(inst.pageGuid()).toBe('g1');
    expect(inst.metadata().title).toBe('T');
    // mode defaults to 'view' -> canInsert false.
    expect(inst.canInsert()).toBe(false);

    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('routes the inspector outputs back into PageContext', async () => {
    const { fixture, http } = await renderShell();
    const ctx = TestBed.inject(PageContext);
    ctx.guid.set('g1');
    ctx.metadata.set(makeMeta());
    TestBed.inject(Layout).update({ inspectorVisible: true }); // I8 gate: panel mounts only while inspectorOpened()
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const inspector = fixture.debugElement.query(By.css('wiki-inspector-panel')).componentInstance as {
      metadataChange: { emit: (m: PageMetadata) => void };
      insertMarkdown: { emit: (s: string) => void };
      titleH1Sync: { emit: (s: string) => void };
      pageTypeChange: { emit: (c: PageTypeChange) => void };
    };

    const insertSeen: string[] = [];
    const titleSeen: string[] = [];
    const typeSeen: PageTypeChange[] = [];
    ctx.insert$.subscribe((s) => insertSeen.push(s));
    ctx.titleH1Sync$.subscribe((s) => titleSeen.push(s));
    ctx.pageTypeChange$.subscribe((c) => typeSeen.push(c));

    const typeChange: PageTypeChange = { pageType: 'pt-task', properties: {} };
    inspector.metadataChange.emit(makeMeta({ title: 'Renamed' }));
    inspector.insertMarkdown.emit('![x](x.png)');
    inspector.titleH1Sync.emit('Renamed');
    inspector.pageTypeChange.emit(typeChange);

    expect(ctx.metadata()?.title).toBe('Renamed');
    expect(insertSeen).toEqual(['![x](x.png)']);
    expect(titleSeen).toEqual(['Renamed']);
    expect(typeSeen).toEqual([typeChange]);

    http.match(() => true).forEach((r) => r.flush(null));
  });

  // ---- Step 1b.4: shell mat-sidenav-container + tree drawer + hamburger ----

  interface ShellHandle {
    treeDrawerOpen: { (): boolean; set(v: boolean): void };
    onPageSelect(guid: string): void;
  }

  function shellHandle(fixture: { componentInstance: unknown }): ShellHandle {
    return fixture.componentInstance as ShellHandle;
  }

  function treeSidenav(fixture: { debugElement: DebugElement }): MatSidenav {
    const all = fixture.debugElement
      .queryAll(By.directive(MatSidenav))
      .map((d) => d.componentInstance as MatSidenav);
    const tree = all.find((s) => s.position === 'start');
    if (!tree) throw new Error('start (tree) sidenav not found');
    return tree;
  }

  async function renderShellAt(isDesktop: boolean) {
    const providers = [...baseProviders(), ...authProviders('Admin')];
    bpStub.isDesktop.set(isDesktop);
    const result = await render(PagesView, { providers });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();
    return { ...result, http };
  }

  it('desktop: tree sidenav is mode="side", always opened, and shows no hamburger', async () => {
    const { fixture } = await renderShellAt(true);
    fixture.detectChanges();

    const tree = treeSidenav(fixture);
    expect(tree.mode).toBe('side');
    expect(tree.opened).toBe(true);
    expect(screen.queryByRole('button', { name: /open navigation/i })).toBeNull();

    // Single hoisted container.
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('mat-sidenav-container'),
    ).toHaveLength(1);
  });

  it('mobile: tree sidenav is mode="over", closed until the drawer opens, hamburger visible', async () => {
    const { fixture } = await renderShellAt(false);
    fixture.detectChanges();

    const tree = treeSidenav(fixture);
    expect(tree.mode).toBe('over');
    expect(tree.opened).toBe(false);
    expect(screen.getByRole('button', { name: /open navigation/i })).toBeInTheDocument();
  });

  it('mobile: clicking the hamburger opens the tree drawer', async () => {
    const { fixture } = await renderShellAt(false);
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /open navigation/i }));
    await settle();
    fixture.detectChanges();

    expect(treeSidenav(fixture).opened).toBe(true);
    expect(shellHandle(fixture).treeDrawerOpen()).toBe(true);
  });

  it('mobile: the tree sidenav (closed) output clears treeDrawerOpen (roll-up 1b.4-c)', async () => {
    const { fixture } = await renderShellAt(false);
    fixture.detectChanges();

    shellHandle(fixture).treeDrawerOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(treeSidenav(fixture).opened).toBe(true);

    // Mirrors the inspector equivalent ("mobile: the sidenav (closed) output
    // clears inspectorSheetOpen") — invoke the (closed) binding directly rather
    // than fight the one-way [opened] binding with a real .close().
    const treeDe = fixture.debugElement
      .queryAll(By.directive(MatSidenav))
      .find((d) => (d.componentInstance as MatSidenav).position === 'start')!;
    treeDe.triggerEventHandler('closed', undefined);
    fixture.detectChanges();
    await settle();

    expect(shellHandle(fixture).treeDrawerOpen()).toBe(false);
  });

  it('onPageSelect closes the drawer on mobile but leaves it untouched on desktop', async () => {
    const { fixture } = await renderShellAt(false);
    fixture.detectChanges();
    const cmp = shellHandle(fixture);
    // provideRouter([]) has no routes; stub navigation so onPageSelect only
    // exercises the drawer-close branch under test.
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    cmp.treeDrawerOpen.set(true);
    fixture.detectChanges();
    cmp.onPageSelect('g-mobile');
    expect(cmp.treeDrawerOpen()).toBe(false);

    bpStub.isDesktop.set(true);
    fixture.detectChanges();
    await settle();

    cmp.treeDrawerOpen.set(true);
    cmp.onPageSelect('g-desktop');
    expect(cmp.treeDrawerOpen()).toBe(true);
  });

  it('keeps the ResizeDivider desktop-only (DESIGN.md D6)', async () => {
    const { fixture } = await renderShellAt(false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(ResizeDivider))).toBeNull();

    bpStub.isDesktop.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(ResizeDivider))).not.toBeNull();
  });

  it('flipping isDesktop false -> true re-pins the tree open in side mode', async () => {
    const { fixture } = await renderShellAt(false);
    fixture.detectChanges();
    expect(treeSidenav(fixture).opened).toBe(false);

    bpStub.isDesktop.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const tree = treeSidenav(fixture);
    expect(tree.mode).toBe('side');
    expect(tree.opened).toBe(true);
  });

  it('regression: the inspector renders inside the shell sidenav container and its outputs still route through PageContext', async () => {
    const { fixture, http } = await renderShellAt(true);
    const ctx = TestBed.inject(PageContext);

    ctx.guid.set('g1');
    ctx.metadata.set(makeMeta());
    TestBed.inject(Layout).update({ inspectorVisible: true }); // I8 gate: panel mounts only while inspectorOpened()
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const container = (fixture.nativeElement as HTMLElement).querySelector('mat-sidenav-container');
    expect(container).toBeTruthy();
    const panel = container!.querySelector('wiki-inspector-panel');
    expect(panel).toBeTruthy();

    const inspector = fixture.debugElement.query(By.css('wiki-inspector-panel')).componentInstance as {
      metadataChange: { emit: (m: PageMetadata) => void };
      insertMarkdown: { emit: (s: string) => void };
    };
    const insertSeen: string[] = [];
    ctx.insert$.subscribe((s) => insertSeen.push(s));

    inspector.insertMarkdown.emit('![x](x.png)');
    inspector.metadataChange.emit(makeMeta({ title: 'Renamed' }));

    expect(insertSeen).toEqual(['![x](x.png)']);
    expect(ctx.metadata()?.title).toBe('Renamed');

    http.match(() => true).forEach((r) => r.flush(null));
  });

  // ---- Step 1b.5: responsive inspector (side <-> bottom sheet) -----------

  function inspectorSidenav(fixture: { debugElement: DebugElement }): MatSidenav {
    const insp = fixture.debugElement
      .queryAll(By.directive(MatSidenav))
      .map((d) => d.componentInstance as MatSidenav)
      .find((s) => s.position === 'end');
    if (!insp) throw new Error('end (inspector) sidenav not found');
    return insp;
  }

  function inspectorSidenavDe(fixture: { debugElement: DebugElement }): DebugElement {
    const de = fixture.debugElement
      .queryAll(By.directive(MatSidenav))
      .find((d) => (d.componentInstance as MatSidenav).position === 'end');
    if (!de) throw new Error('end (inspector) sidenav not found');
    return de;
  }

  async function renderShellWithPage(isDesktop: boolean) {
    localStorage.clear();
    const r = await renderShellAt(isDesktop);
    const ctx = TestBed.inject(PageContext);
    ctx.guid.set('g1');
    ctx.metadata.set(makeMeta());
    r.fixture.detectChanges();
    await settle();
    r.fixture.detectChanges();
    return { ...r, ctx };
  }

  it('desktop: the inspector is mode="side" and stays closed while Layout.inspectorVisible() is false', async () => {
    const { fixture } = await renderShellWithPage(true);
    const insp = inspectorSidenav(fixture);
    expect(insp.mode).toBe('side');
    expect(insp.opened).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.inspector')!.classList)
      .not.toContain('mobile-sheet');
  });

  it('desktop: toggling opens the side inspector; toggling again closes it and persists inspectorVisible=false', async () => {
    const { fixture, ctx } = await renderShellWithPage(true);
    const layout = TestBed.inject(Layout);

    ctx.toggleInspector(); // desktop -> layout.update({ inspectorVisible: true })
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(layout.inspectorVisible()).toBe(true);
    expect(inspectorSidenav(fixture).opened).toBe(true);

    ctx.toggleInspector(); // desktop -> layout.update({ inspectorVisible: false })
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(layout.inspectorVisible()).toBe(false);
    expect(inspectorSidenav(fixture).opened).toBe(false);
  });

  it('desktop: a stray/duplicate (closed) with the inspector already closed does NOT re-write Layout (roll-up 1b.5-a)', async () => {
    const { fixture, ctx } = await renderShellWithPage(true);
    const layout = TestBed.inject(Layout);

    ctx.toggleInspector();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    ctx.toggleInspector();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(layout.inspectorVisible()).toBe(false);

    const updateSpy = jest.spyOn(layout, 'update');
    inspectorSidenavDe(fixture).triggerEventHandler('closed', undefined);
    fixture.detectChanges();
    await settle();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(layout.inspectorVisible()).toBe(false);
  });

  it('desktop: a stale late (closed) after the page reloads does NOT clobber persisted inspectorVisible (review I2)', async () => {
    const { fixture, ctx } = await renderShellWithPage(true);
    const layout = TestBed.inject(Layout);

    ctx.toggleInspector(); // open the desktop inspector
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(layout.inspectorVisible()).toBe(true);
    expect(inspectorSidenav(fixture).opened).toBe(true);

    // A View<->Edit toggle: PageDetail destroy nulls guid/metadata, the
    // replacement immediately re-publishes them, THEN the async (closed) from
    // the aborted close lands. The guard on guid/metadata alone would pass and
    // wipe inspectorVisible; reconciling against inspectorOpened() must not.
    ctx.guid.set(null);
    ctx.metadata.set(null);
    ctx.guid.set('g1');
    ctx.metadata.set(makeMeta());
    fixture.detectChanges();

    inspectorSidenavDe(fixture).triggerEventHandler('closed', undefined);
    fixture.detectChanges();
    await settle();

    expect(layout.inspectorVisible()).toBe(true);
    expect(inspectorSidenav(fixture).opened).toBe(true);
  });

  it('desktop: the inspector stays closed while inspectorVisible is true but no page is loaded (gated)', async () => {
    localStorage.clear();
    const { fixture } = await renderShellAt(true); // no page pushed into PageContext
    const layout = TestBed.inject(Layout);
    layout.update({ inspectorVisible: true });
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(inspectorSidenav(fixture).opened).toBe(false);
  });

  it('desktop: opens on mount when the Layout store already has the inspector visible (re-homed 1b.5-I2)', async () => {
    localStorage.setItem('bluefinwiki-layout', JSON.stringify({ inspectorVisible: true }));
    const r = await renderShellAt(true);
    const ctx = TestBed.inject(PageContext);
    ctx.guid.set('g1');
    ctx.metadata.set(makeMeta());
    r.fixture.detectChanges();
    await settle();
    r.fixture.detectChanges();

    expect(inspectorSidenav(r.fixture).opened).toBe(true);
    localStorage.clear();
  });

  it('desktop: the inspector width binds to Layout.inspectorWidth() and reflects a later change (re-homed 1b.5-I2)', async () => {
    const { fixture } = await renderShellWithPage(true);
    const layout = TestBed.inject(Layout);
    const inspector = (fixture.nativeElement as HTMLElement).querySelector('.inspector') as HTMLElement;

    expect(inspector.style.width).toBe(`${layout.inspectorWidth()}px`);

    layout.update({ inspectorWidth: 480 });
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(inspector.style.width).toBe('480px');
  });

  it('desktop: the inspector divider maps pointer X to a right-anchored width via Layout.update (re-homed 1b.5-I2)', async () => {
    const { fixture } = await renderShellWithPage(true);
    const layout = TestBed.inject(Layout);
    const updateSpy = jest.spyOn(layout, 'update');

    const dividers = fixture.debugElement.queryAll(By.directive(ResizeDivider));
    expect(dividers).toHaveLength(2); // tree divider + inspector divider
    const inspectorDivider = dividers[dividers.length - 1].componentInstance as ResizeDivider;

    // The exact pointer-X -> width math (right-anchored, relative to the shell
    // right edge) is pinned in the sibling test that mocks the rect. Here we
    // only assert the divider routes through Layout.update with an inspectorWidth
    // patch, and that the store clamps the result to the 250 floor (jsdom's
    // all-zero rect makes the raw width negative).
    inspectorDivider.resized.emit(80);
    await settle();

    const patch = updateSpy.mock.calls.at(-1)?.[0];
    expect(patch).toHaveProperty('inspectorWidth');
    expect(typeof patch?.inspectorWidth).toBe('number');
    expect(layout.inspectorWidth()).toBe(250);
  });

  it('desktop: maps the inspector divider pointer X relative to the shell right edge', async () => {
    const { fixture } = await renderShellWithPage(true);
    const layout = TestBed.inject(Layout);
    const body = (fixture.nativeElement as HTMLElement).querySelector('.body') as HTMLElement;
    jest.spyOn(body, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 1000, top: 0, bottom: 0, width: 1000, height: 0, x: 0, y: 0, toJSON: () => ({}),
    });

    const dividers = fixture.debugElement.queryAll(By.directive(ResizeDivider));
    const inspectorDivider = dividers[dividers.length - 1].componentInstance as ResizeDivider;
    inspectorDivider.resized.emit(600); // 1000 - 600 = 400, within 250-600
    await settle();

    expect(layout.inspectorWidth()).toBe(400);
  });

  it('mobile: the inspector is mode="over", has the mobile-sheet class and no divider', async () => {
    const { fixture } = await renderShellWithPage(false);
    const insp = inspectorSidenav(fixture);
    expect(insp.mode).toBe('over');
    expect((fixture.nativeElement as HTMLElement).querySelector('.inspector')!.classList)
      .toContain('mobile-sheet');
    expect(fixture.debugElement.queryAll(By.directive(ResizeDivider))).toHaveLength(0);
  });

  it('mobile: the inspector opened state tracks ctx.inspectorSheetOpen()', async () => {
    const { fixture, ctx } = await renderShellWithPage(false);
    expect(inspectorSidenav(fixture).opened).toBe(false);

    ctx.toggleInspector(); // mobile -> inspectorSheetOpen flips true
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(ctx.inspectorSheetOpen()).toBe(true);
    expect(inspectorSidenav(fixture).opened).toBe(true);
  });

  it('mobile: the sidenav (closed) output clears inspectorSheetOpen', async () => {
    const { fixture, ctx } = await renderShellWithPage(false);
    ctx.inspectorSheetOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(inspectorSidenav(fixture).opened).toBe(true);

    inspectorSidenavDe(fixture).triggerEventHandler('closed', undefined);
    fixture.detectChanges();
    await settle();

    expect(ctx.inspectorSheetOpen()).toBe(false);
  });

  it('flipping to desktop while the mobile sheet is open closes it cleanly (no stuck backdrop)', async () => {
    const { fixture, ctx } = await renderShellWithPage(false);
    ctx.inspectorSheetOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(inspectorSidenav(fixture).opened).toBe(true);

    bpStub.isDesktop.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const insp = inspectorSidenav(fixture);
    expect(insp.mode).toBe('side');
    expect(ctx.inspectorSheetOpen()).toBe(false);
    expect(insp.opened).toBe(false); // desktop follows Layout.inspectorVisible(), never set
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.mat-drawer-backdrop.mat-drawer-shown'),
    ).toBeNull();
  });

  it('flipping to mobile while the desktop inspector is open does NOT surface it as a bottom sheet', async () => {
    const { fixture } = await renderShellWithPage(true);
    const layout = TestBed.inject(Layout);
    layout.update({ inspectorVisible: true });
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(inspectorSidenav(fixture).opened).toBe(true);

    bpStub.isDesktop.set(false);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const insp = inspectorSidenav(fixture);
    expect(insp.mode).toBe('over');
    // A desktop-open inspector must not become a mobile sheet — the sheet flag
    // was never set, so opened falls back to ctx.inspectorSheetOpen() === false.
    expect(insp.opened).toBe(false);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.mat-drawer-backdrop.mat-drawer-shown'),
    ).toBeNull();
  });

  // ---- Step 4.10 / Phase 4 review I8: gate the inspector panel on inspectorOpened() ----

  it('desktop: does NOT mount wiki-inspector-panel while the inspector is closed (page loaded)', async () => {
    const { fixture } = await renderShellWithPage(true); // localStorage cleared → inspectorVisible false
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-inspector-panel')).toBeNull();
    // The sidenav shell itself still renders — only its content is deferred.
    expect(inspectorSidenav(fixture)).toBeTruthy();
  });

  it('mobile: does NOT mount wiki-inspector-panel while the inspector sheet is closed (page loaded)', async () => {
    const { fixture } = await renderShellWithPage(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-inspector-panel')).toBeNull();
  });

  it('desktop: mounts wiki-inspector-panel once the inspector is opened', async () => {
    const { fixture, ctx, http } = await renderShellWithPage(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-inspector-panel')).toBeNull();

    ctx.toggleInspector();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-inspector-panel')).toBeTruthy();
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('mobile: mounts wiki-inspector-panel once the inspector sheet is opened', async () => {
    const { fixture, ctx, http } = await renderShellWithPage(false);
    ctx.inspectorSheetOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-inspector-panel')).toBeTruthy();
    http.match(() => true).forEach((r) => r.flush(null));
  });

  // ---- Step 1b.9: AI full-width overlay + full-screen search dialog ------

  interface AiHandle {
    aiOpen: { (): boolean; set(v: boolean): void };
  }

  function spyDialogOpen(): jest.SpyInstance {
    const dialog = TestBed.inject(MatDialog);
    return jest
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => ({ subscribe: () => undefined }) } as never);
  }

  // Narrow structural shape for the fields these tests probe on the captured
  // MatDialogConfig — a plain Record<string, unknown> trips
  // noPropertyAccessFromIndexSignature (TS4111) under tsconfig.spec.json.
  interface DialogConfigProbe {
    width?: unknown;
    height?: unknown;
    maxWidth?: unknown;
    panelClass?: unknown;
  }
  type OpenCall = [dialogArg: unknown, config?: DialogConfigProbe];

  function firstOpenCall(openSpy: jest.SpyInstance): { dialogArg: unknown; config: DialogConfigProbe } {
    const call = (openSpy.mock.calls as OpenCall[]).at(0);
    if (!call) throw new Error('MatDialog.open was not called');
    return { dialogArg: call[0], config: call[1] ?? {} };
  }

  function pressSearchKey(combo: 'ctrl' | 'cmd'): void {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: combo === 'ctrl',
        metaKey: combo === 'cmd',
        cancelable: true,
      }),
    );
  }

  it('mobile + aiOpen: the AI sidebar mounts in the full-width .ai-overlay, not the .ai-pane', async () => {
    const { fixture } = await renderShellAt(false);
    (fixture.componentInstance as unknown as AiHandle).aiOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.ai-overlay')).toBeTruthy();
    expect(host.querySelector('.ai-pane')).toBeNull();
    expect(host.querySelector('.ai-overlay wiki-ai-sidebar')).toBeTruthy();
  });

  it('mobile + aiOpen: the .ai-overlay is a direct child of .pages-shell, hoisted OUT of mat-sidenav-content (review C1)', async () => {
    const { fixture } = await renderShellAt(false);
    (fixture.componentInstance as unknown as AiHandle).aiOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    // It must be a sibling of .topbar so its z-index can out-rank the toolbar.
    expect(host.querySelector('.pages-shell > .ai-overlay')).not.toBeNull();
    // It must NOT be nested in the sidenav content (z-index: 1 there — can
    // never cover the z-index: 2 toolbar).
    expect(host.querySelector('mat-sidenav-content .ai-overlay')).toBeNull();
  });

  it('desktop + aiOpen: the AI sidebar mounts in the .ai-pane column, no overlay class', async () => {
    const { fixture } = await renderShellAt(true);
    (fixture.componentInstance as unknown as AiHandle).aiOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.ai-pane')).toBeTruthy();
    expect(host.querySelector('.ai-overlay')).toBeNull();
  });

  it('mobile: the AI overlay has an in-panel close control that clears aiOpen', async () => {
    const { fixture } = await renderShellAt(false);
    const cmp = fixture.componentInstance as unknown as AiHandle;
    cmp.aiOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /close ai assistant/i }));
    await settle();
    fixture.detectChanges();

    expect(cmp.aiOpen()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.ai-overlay')).toBeNull();
  });

  // ---- Review I3 / DESIGN.md D9: the three mobile surfaces are mutually exclusive ----

  it('mobile: opening the tree drawer closes an open inspector sheet (I3 / D9)', async () => {
    const { fixture, ctx } = await renderShellWithPage(false);

    ctx.inspectorSheetOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(inspectorSidenav(fixture).opened).toBe(true);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /open navigation/i }));
    await settle();
    fixture.detectChanges();

    expect(shellHandle(fixture).treeDrawerOpen()).toBe(true);
    expect(ctx.inspectorSheetOpen()).toBe(false);
  });

  it('mobile: opening the AI overlay closes the inspector sheet; the hamburger then closes the AI overlay (I3 / D9)', async () => {
    const { fixture, ctx } = await renderShellWithPage(false);
    const cmp = fixture.componentInstance as unknown as AiHandle & { onToggleAi(): void };

    ctx.inspectorSheetOpen.set(true);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    cmp.onToggleAi(); // open the AI overlay on mobile
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(cmp.aiOpen()).toBe(true);
    expect(ctx.inspectorSheetOpen()).toBe(false);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /open navigation/i }));
    await settle();
    fixture.detectChanges();

    expect(shellHandle(fixture).treeDrawerOpen()).toBe(true);
    expect(cmp.aiOpen()).toBe(false);
  });

  it('desktop: opening the AI pane leaves the inspector untouched (mutual exclusion is mobile-only)', async () => {
    const { fixture, ctx } = await renderShellWithPage(true);
    const layout = TestBed.inject(Layout);
    const cmp = fixture.componentInstance as unknown as AiHandle & { onToggleAi(): void };

    ctx.toggleInspector(); // desktop -> Layout.inspectorVisible true
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    expect(inspectorSidenav(fixture).opened).toBe(true);

    cmp.onToggleAi();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(cmp.aiOpen()).toBe(true);
    expect(layout.inspectorVisible()).toBe(true);
    expect(inspectorSidenav(fixture).opened).toBe(true);
  });

  for (const combo of ['ctrl', 'cmd'] as const) {
    it(`mobile: ${combo}+K opens SearchDialog full-screen (100vw x 100vh + fullscreen-dialog panel class)`, async () => {
      await renderShellAt(false);
      const openSpy = spyDialogOpen();

      pressSearchKey(combo);
      await settle();

      expect(openSpy).toHaveBeenCalledTimes(1);
      const { dialogArg, config } = firstOpenCall(openSpy);
      expect(dialogArg).toBe(SearchDialog);
      expect(config.width).toBe('100vw');
      expect(config.height).toBe('100vh');
      expect(config.maxWidth).toBe('100vw');
      expect(config.panelClass).toEqual(
        expect.arrayContaining(['wiki-search-dialog-panel', 'fullscreen-dialog']),
      );
    });

    it(`desktop: ${combo}+K opens SearchDialog at the 640px centered config (no fullscreen-dialog)`, async () => {
      await renderShellAt(true);
      const openSpy = spyDialogOpen();

      pressSearchKey(combo);
      await settle();

      expect(openSpy).toHaveBeenCalledTimes(1);
      const { config } = firstOpenCall(openSpy);
      expect(config.width).toBe('640px');
      expect(config.height).toBeUndefined();
      const panelClass = Array.isArray(config.panelClass)
        ? (config.panelClass as string[])
        : [config.panelClass as string];
      expect(panelClass).toContain('wiki-search-dialog-panel');
      expect(panelClass).not.toContain('fullscreen-dialog');
    });
  }

  // ---- Step 2.5: rename modal is pre-filled with the real page title --------

  interface RenameHandle {
    onRenameRequested(req: { guid: string; title: string }): void;
    renameTarget: () => { guid: string; title: string } | null;
  }

  it('onRenameRequested stores the guid + real title from the tree payload', async () => {
    const { fixture, http } = await renderShell();
    const cmp = fixture.componentInstance as unknown as RenameHandle;

    cmp.onRenameRequested({ guid: 'g', title: 'Real Title' });

    expect(cmp.renameTarget()).toEqual({ guid: 'g', title: 'Real Title' });
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('passes the real title through to wiki-page-rename-inline as initialTitle', async () => {
    const { fixture, http } = await renderShell();
    const cmp = fixture.componentInstance as unknown as RenameHandle;

    cmp.onRenameRequested({ guid: 'g', title: 'Real Title' });
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const inline = fixture.debugElement.query(By.css('wiki-page-rename-inline'))
      .componentInstance as { guid: () => string; initialTitle: () => string };
    expect(inline.guid()).toBe('g');
    expect(inline.initialTitle()).toBe('Real Title');

    http.match(() => true).forEach((r) => r.flush(null));
  });

  // ---- Step 2.8: Delete via ConfirmDialog (leaf vs has-children copy) -------

  interface DeleteHandle {
    onDeleteRequested(req: { guid: string; hasChildren: boolean }): Promise<void>;
  }

  function stubConfirm(result: boolean): jest.SpyInstance {
    const dialog = TestBed.inject(MatDialog);
    return jest
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(result) } as never);
  }

  interface ConfirmDataProbe {
    title: string;
    message: string;
    confirmLabel?: string;
    destructive?: boolean;
  }

  function lastConfirmData(openSpy: jest.SpyInstance): ConfirmDataProbe {
    const call = (openSpy.mock.calls as [unknown, { data: ConfirmDataProbe }?][]).at(-1);
    if (!call) throw new Error('MatDialog.open was not called');
    expect(call[0]).toBe(ConfirmDialog);
    if (!call[1]) throw new Error('MatDialog.open called without a config');
    return call[1].data;
  }

  it('leaf page: opens ConfirmDialog with the leaf copy and deletes with recursive:false', async () => {
    const { fixture, http } = await renderShell();
    const cmp = fixture.componentInstance as unknown as DeleteHandle;
    const pages = TestBed.inject(Pages);
    const deleteSpy = jest.spyOn(pages, 'deletePage').mockResolvedValue(undefined);
    const openSpy = stubConfirm(true);

    await cmp.onDeleteRequested({ guid: 'leaf-1', hasChildren: false });
    await settle();

    expect(lastConfirmData(openSpy).message).toBe('Delete this page?');
    expect(lastConfirmData(openSpy).destructive).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith('leaf-1', { recursive: false });

    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('has-children: opens ConfirmDialog with the count-free child-aware copy and deletes with recursive:true', async () => {
    const { fixture, http } = await renderShell();
    const cmp = fixture.componentInstance as unknown as DeleteHandle;
    const pages = TestBed.inject(Pages);
    const deleteSpy = jest.spyOn(pages, 'deletePage').mockResolvedValue(undefined);
    const openSpy = stubConfirm(true);

    await cmp.onDeleteRequested({ guid: 'parent-1', hasChildren: true });
    await settle();

    expect(lastConfirmData(openSpy).message).toBe(
      'Delete this page and all its child pages? This action cannot be undone.',
    );
    expect(deleteSpy).toHaveBeenCalledWith('parent-1', { recursive: true });

    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('dismissing the ConfirmDialog does NOT call deletePage', async () => {
    const { fixture, http } = await renderShell();
    const cmp = fixture.componentInstance as unknown as DeleteHandle;
    const pages = TestBed.inject(Pages);
    const deleteSpy = jest.spyOn(pages, 'deletePage').mockResolvedValue(undefined);
    stubConfirm(false);

    await cmp.onDeleteRequested({ guid: 'leaf-1', hasChildren: false });
    await settle();

    expect(deleteSpy).not.toHaveBeenCalled();

    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('surfaces the server error message in a snackbar when the delete fails', async () => {
    const { fixture, http } = await renderShell();
    const cmp = fixture.componentInstance as unknown as DeleteHandle;
    const pages = TestBed.inject(Pages);
    jest.spyOn(pages, 'deletePage').mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { message: 'Page is referenced by other pages.' },
      }),
    );
    const snack = TestBed.inject(MatSnackBar);
    const snackSpy = jest.spyOn(snack, 'open').mockReturnValue({} as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    stubConfirm(true);

    await cmp.onDeleteRequested({ guid: 'leaf-1', hasChildren: false });
    await settle();

    expect(snackSpy).toHaveBeenCalledWith(
      'Page is referenced by other pages.',
      'Dismiss',
      { duration: 4000 },
    );
    errorSpy.mockRestore();

    http.match(() => true).forEach((r) => r.flush(null));
  });
});
