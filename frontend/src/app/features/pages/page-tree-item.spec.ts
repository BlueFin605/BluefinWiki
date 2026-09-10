import { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PageTreeItem } from './page-tree-item';
import type { ContextMenuEvent } from './page-context-menu';
import type { PageSummary } from './page.types';

function summary(over: Partial<PageSummary> = {}): PageSummary {
  return {
    guid: 'g',
    title: 'Title',
    parentGuid: null,
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

describe('PageTreeItem', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('renders the title', async () => {
    await render(PageTreeItem, {
      inputs: { page: summary({ title: 'Hello' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('shows a chevron only when hasChildren', async () => {
    const { rerender } = await render(PageTreeItem, {
      inputs: { page: summary({ hasChildren: true, guid: 'parent' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();

    await rerender({
      inputs: { page: summary({ hasChildren: false, guid: 'leaf' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    expect(screen.queryByRole('button', { name: /expand/i })).toBeNull();
  });

  it('emits pageSelect on row click', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1', title: 'Click me' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    fixture.componentInstance.pageSelect.subscribe((g: string) => calls.push(g));
    await user.click(screen.getByText('Click me'));
    expect(calls).toEqual(['g1']);
  });

  it('emits renameRequested with the row guid + real title on double-click', async () => {
    const user = userEvent.setup();
    const events: unknown[] = [];
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1', title: 'Dbl' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    fixture.componentInstance.renameRequested.subscribe((e: unknown) => events.push(e));
    await user.dblClick(screen.getByText('Dbl'));
    expect(events).toEqual([{ guid: 'g1', title: 'Dbl' }]);
  });

  it('emits renameRequested with the row guid + real title on F2', async () => {
    const events: unknown[] = [];
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1', title: 'Eff Two' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    fixture.componentInstance.renameRequested.subscribe((e: unknown) => events.push(e));
    const row = screen.getByRole('treeitem');
    row.focus();
    fireEvent.keyDown(row, { key: 'F2' });
    expect(events).toEqual([{ guid: 'g1', title: 'Eff Two' }]);
  });

  it('emits renameRequested with the row guid + real title from the context menu', async () => {
    const events: unknown[] = [];
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1', title: 'Ctx' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    fixture.componentInstance.renameRequested.subscribe((e: unknown) => events.push(e));
    const renameEvent: ContextMenuEvent = { kind: 'rename', guid: 'g1' };
    fixture.componentInstance.onMenuEvent(renameEvent);
    expect(events).toEqual([{ guid: 'g1', title: 'Ctx' }]);
  });

  it('lazy-loads children when expanded', async () => {
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'parent', hasChildren: true }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    const http = TestBed.inject(HttpTestingController);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /expand/i }));
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    http.expectOne('/api/pages/parent/children').flush({
      children: [summary({ guid: 'child1', title: 'Child' })],
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(screen.getByText('Child')).toBeInTheDocument();
    http.verify();
  });

  it('applies the active class when activeGuid matches', async () => {
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1' }), level: 0, activeGuid: 'g1', pageTypesMap: {} },
    });
    const row = (fixture.nativeElement as HTMLElement).querySelector('.page-tree-row');
    expect(row?.classList.contains('active')).toBe(true);
  });

  it('emits newChildRequested when the add-child button is clicked', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    fixture.componentInstance.newChildRequested.subscribe((g: string) => events.push(g));
    await user.click(screen.getByRole('button', { name: /add child page/i }));
    expect(events).toEqual(['g1']);
  });

  // ---- Step 2.3: arrow-key expand/collapse + aria-expanded ----------------

  async function flush(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }

  async function renderExpandedParent() {
    const result = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'parent', hasChildren: true }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    const http = TestBed.inject(HttpTestingController);
    fireEvent.keyDown(screen.getByRole('treeitem'), { key: 'ArrowRight' });
    await flush();
    result.fixture.detectChanges();
    http.expectOne('/api/pages/parent/children').flush({
      children: [summary({ guid: 'child1', title: 'Child' })],
    });
    await flush();
    result.fixture.detectChanges();
    return { ...result, http };
  }

  it('does not set aria-expanded on a leaf row', async () => {
    await render(PageTreeItem, {
      inputs: { page: summary({ hasChildren: false, guid: 'leaf' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    expect(screen.getByRole('treeitem')).not.toHaveAttribute('aria-expanded');
  });

  it('keydown ArrowRight on a collapsed parent expands it and sets aria-expanded="true"', async () => {
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ hasChildren: true, guid: 'p' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    const row = screen.getByRole('treeitem');
    expect(row).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(row, { key: 'ArrowRight' });
    fixture.detectChanges();

    expect(row).toHaveAttribute('aria-expanded', 'true');
  });

  it('keydown ArrowRight on an expanded parent moves focus to the first child row', async () => {
    await renderExpandedParent();
    const rows = screen.getAllByRole('treeitem');
    rows[0].focus();

    fireEvent.keyDown(rows[0], { key: 'ArrowRight' });

    expect(document.activeElement).toBe(rows[1]);
    expect(rows[1]).toHaveTextContent('Child');
  });

  it('keydown ArrowRight on a leaf row is a no-op', async () => {
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ hasChildren: false, guid: 'leaf' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    const row = screen.getByRole('treeitem');
    row.focus();
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    fixture.detectChanges();
    expect(row).not.toHaveAttribute('aria-expanded');
    expect(document.activeElement).toBe(row);
  });

  it('keydown ArrowLeft on an expanded parent collapses it', async () => {
    const { fixture, http } = await renderExpandedParent();
    const row = screen.getAllByRole('treeitem')[0];
    expect(row).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    fixture.detectChanges();

    expect(row).toHaveAttribute('aria-expanded', 'false');
    http.verify();
  });

  it('keydown ArrowLeft on a collapsed child moves focus to the parent row', async () => {
    await renderExpandedParent();
    const rows = screen.getAllByRole('treeitem');
    rows[1].focus();

    fireEvent.keyDown(rows[1], { key: 'ArrowLeft' });

    expect(document.activeElement).toBe(rows[0]);
  });

  it('expands the matching node when expandGuid targets its guid, loading its children', async () => {
    const { rerender, fixture } = await render(PageTreeItem, {
      inputs: {
        page: summary({ guid: 'target', hasChildren: true }),
        level: 0, activeGuid: null, pageTypesMap: {}, expandGuid: null,
      },
    });
    const row = screen.getByRole('treeitem');
    expect(row).toHaveAttribute('aria-expanded', 'false');

    await rerender({
      inputs: {
        page: summary({ guid: 'target', hasChildren: true }),
        level: 0, activeGuid: null, pageTypesMap: {}, expandGuid: { guid: 'target', nonce: 1 },
      },
    });
    await flush();
    fixture.detectChanges();

    expect(row).toHaveAttribute('aria-expanded', 'true');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/target/children').flush({ children: [] });
    http.verify();
  });

  it('ignores an expandGuid that targets a different node', async () => {
    const { rerender, fixture } = await render(PageTreeItem, {
      inputs: {
        page: summary({ guid: 'target', hasChildren: true }),
        level: 0, activeGuid: null, pageTypesMap: {}, expandGuid: null,
      },
    });
    await rerender({
      inputs: {
        page: summary({ guid: 'target', hasChildren: true }),
        level: 0, activeGuid: null, pageTypesMap: {}, expandGuid: { guid: 'someone-else', nonce: 1 },
      },
    });
    await flush();
    fixture.detectChanges();
    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-expanded', 'false');
  });

  it('re-expands a since-collapsed node when a fresh expandGuid nonce targets the same guid', async () => {
    const base = {
      page: summary({ guid: 'target', hasChildren: true }),
      level: 0, activeGuid: null, pageTypesMap: {},
    };
    const { rerender, fixture } = await render(PageTreeItem, {
      inputs: { ...base, expandGuid: null },
    });
    const http = TestBed.inject(HttpTestingController);
    const row = screen.getByRole('treeitem');

    // First force-expand.
    await rerender({ inputs: { ...base, expandGuid: { guid: 'target', nonce: 1 } } });
    await flush();
    fixture.detectChanges();
    http.expectOne('/api/pages/target/children').flush({ children: [] });
    await flush();
    fixture.detectChanges();
    expect(row).toHaveAttribute('aria-expanded', 'true');

    // User collapses it.
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    fixture.detectChanges();
    expect(row).toHaveAttribute('aria-expanded', 'false');

    // Same guid, fresh nonce -> re-expands (a bare string would not change).
    await rerender({ inputs: { ...base, expandGuid: { guid: 'target', nonce: 2 } } });
    await flush();
    fixture.detectChanges();
    http.expectOne('/api/pages/target/children').flush({ children: [] });
    await flush();
    fixture.detectChanges();
    expect(row).toHaveAttribute('aria-expanded', 'true');
    http.verify();
  });

  it('enterPredicate rejects drops onto self', async () => {
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'g1' }), level: 0, activeGuid: null, pageTypesMap: {} },
    });
    const item = fixture.componentInstance;
    const fakeDrag = { data: summary({ guid: 'g1' }) } as unknown as Parameters<typeof item.enterPredicate>[0];
    expect(item.enterPredicate(fakeDrag)).toBe(false);
  });

  it('enterPredicate respects pageTypesMap constraints', async () => {
    const map = {
      parent: { guid: 'parent', name: 'P', icon: '', properties: [],
        allowedChildTypes: ['allowed-type'], allowWikiPageChildren: true,
        allowedParentTypes: [], allowAnyParent: true,
        createdBy: '', createdAt: '', updatedAt: '' },
    };
    const { fixture } = await render(PageTreeItem, {
      inputs: { page: summary({ guid: 'target', pageType: 'parent' }), level: 0, activeGuid: null, pageTypesMap: map },
    });
    const item = fixture.componentInstance;
    const draggedAllowed = { data: summary({ guid: 'd', pageType: 'allowed-type' }) } as unknown as Parameters<typeof item.enterPredicate>[0];
    const draggedBlocked = { data: summary({ guid: 'd', pageType: 'blocked-type' }) } as unknown as Parameters<typeof item.enterPredicate>[0];
    expect(item.enterPredicate(draggedAllowed)).toBe(true);
    expect(item.enterPredicate(draggedBlocked)).toBe(false);
  });
});
