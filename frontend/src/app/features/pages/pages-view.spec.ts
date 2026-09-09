jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), render: jest.fn() },
}));

import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { Auth } from '../../core/auth/auth';
import { Layout } from '../../core/layout/layout';
import { PagesView } from './pages-view';
import { PageContext } from './page-context';
import { PageTree } from './page-tree';
import { ResizeDivider } from '../../shared/components/resize-divider';
import { SearchDialog } from '../search/search-dialog';
import type { PageTypeDefinition } from './page.types';
import type { PageMetadata } from './drafts';

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

function baseProviders() {
  return [
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
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

  it('renders the hoisted wiki-inspector-panel once PageContext has a guid + metadata', async () => {
    const { fixture, http } = await renderShell();
    const ctx = TestBed.inject(PageContext);

    ctx.guid.set('g1');
    ctx.metadata.set(makeMeta());
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
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    const inspector = fixture.debugElement.query(By.css('wiki-inspector-panel')).componentInstance as {
      metadataChange: { emit: (m: PageMetadata) => void };
      insertMarkdown: { emit: (s: string) => void };
      titleH1Sync: { emit: (s: string) => void };
    };

    const insertSeen: string[] = [];
    const titleSeen: string[] = [];
    ctx.insert$.subscribe((s) => insertSeen.push(s));
    ctx.titleH1Sync$.subscribe((s) => titleSeen.push(s));

    inspector.metadataChange.emit(makeMeta({ title: 'Renamed' }));
    inspector.insertMarkdown.emit('![x](x.png)');
    inspector.titleH1Sync.emit('Renamed');

    expect(ctx.metadata()?.title).toBe('Renamed');
    expect(insertSeen).toEqual(['![x](x.png)']);
    expect(titleSeen).toEqual(['Renamed']);

    http.match(() => true).forEach((r) => r.flush(null));
  });
});
