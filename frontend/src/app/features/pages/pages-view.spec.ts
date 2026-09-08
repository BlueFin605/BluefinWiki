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
import { PagesView } from './pages-view';
import { PageTree } from './page-tree';
import { SearchDialog } from '../search/search-dialog';
import type { PageTypeDefinition } from './page.types';

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
});
