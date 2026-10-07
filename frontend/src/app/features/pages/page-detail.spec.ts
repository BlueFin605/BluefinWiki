import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { convertToParamMap, type ParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';

jest.mock('mermaid', () => ({
  default: {
    initialize: jest.fn(),
    parse: jest.fn(),
    render: jest.fn().mockResolvedValue({ svg: '<svg/>' }),
  },
}));

import { PageDetail, resolveSaveStatus } from './page-detail';
import { PageContext } from './page-context';
import { Pages } from './pages';
import { BoardView } from '../board/board-view';
import { AttachmentUploader } from '../attachments/attachment-uploader';
import { buildAttachmentMarkdown } from '../attachments/attachment.types';
import { Drafts } from './drafts';
import { errorInterceptor } from '../../core/api/error-interceptor';
import { Layout } from '../../core/layout/layout';
import { provideBreakpointStub } from '../../testing/breakpoint-stub';
import { ResizeDivider } from '../../shared/components/resize-divider';
import { WikiTableOfContents } from '../../shared/markdown/table-of-contents';
import { EditorErrorState } from '../../core/error/editor-error-state';
import { InvalidationBus, pageTag } from '../../core/api/invalidation';
import type { PageProperty } from './page.types';
import { Auth } from '../../core/auth/auth';
import { pageTypesListTag } from '../../core/api/invalidation';

const serverPage = {
  guid: 'g1',
  title: 'Page Title',
  content: '# Original',
  folderId: 'f',
  tags: [] as string[],
  status: 'published' as const,
  createdBy: 'u',
  modifiedBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
};

function routeStub(guid: string | null, editMode = false) {
  const paramMap: ParamMap = convertToParamMap(guid ? { guid } : {});
  return {
    provide: ActivatedRoute,
    useValue: {
      paramMap: of(paramMap),
      data: of(editMode ? { editMode: true } : {}),
    },
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** Drain background fetches from breadcrumbs / inspector loaders. */
function drain(): void {
  try {
    const http = TestBed.inject(HttpTestingController);
    http.match(() => true).forEach((req) => req.flush(null));
  } catch {
    // TestBed torn down — nothing to do.
  }
}

async function renderDetail(
  opts: {
    guid?: string;
    editMode?: boolean;
    noopAnimations?: boolean;
    isDesktop?: boolean;
    user?: { userId: string; role: 'Admin' | 'Standard' };
  } = {},
) {
  const user = opts.user ?? { userId: 'u', role: 'Admin' as const };
  const guid = opts.guid ?? 'g1';
  // PageContext.toggleInspector() and the editor-bar control both branch on
  // Breakpoint; default to desktop so the toggle drives Layout.inspectorVisible
  // (step 4.1 path) and the bar renders the "Toggle inspector" button.
  const bpStub = provideBreakpointStub(opts.isDesktop ?? true);
  const result = await render(PageDetail, {
    providers: [
      opts.noopAnimations ? provideNoopAnimations() : provideAnimationsAsync(),
      // The app's errorInterceptor, so HTTP errors reach the component as the
      // ApiError it really sees, not a raw HttpErrorResponse.
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      routeStub(guid, opts.editMode),
      ...bpStub.providers,
      {
        provide: Auth,
        useValue: {
          user: () => ({ ...user, email: 'a@b', displayName: 'A', emailVerified: true }),
        },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  return { ...result, http, guid, bpStub };
}

describe('PageDetail', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => drain());

  it('shows a loading indicator while fetching', async () => {
    const { http } = await renderDetail();
    expect(screen.getByText(/loading page/i)).toBeInTheDocument();
    http.expectOne('/api/pages/g1').flush(serverPage);
  });

  it('shows an error state on fetch failure', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(
      { message: 'Not found' },
      { status: 404, statusText: 'Not Found' },
    );
    await settle();
    fixture.detectChanges();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('renders markdown content in view mode', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Hello world' });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('heading', { name: 'Hello world' })).toBeInTheDocument();
  });

  describe('ticket key chip', () => {
    it('shows the key chip and copies the key on click', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const { http, fixture } = await renderDetail();
      http.expectOne('/api/pages/g1').flush({ ...serverPage, ticketKey: 'BGT-3' });
      await settle();
      fixture.detectChanges();
      const snackSpy = jest.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue({} as never);

      const chip = screen.getByTestId('page-ticket-key');
      expect(chip.textContent?.trim()).toBe('BGT-3');
      chip.click();
      await settle();

      expect(writeText).toHaveBeenCalledWith('BGT-3');
      expect(snackSpy).toHaveBeenCalledWith('Copied BGT-3', undefined, { duration: 2000 });
    });

    it('copies a key link next to the chip', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const { http, fixture } = await renderDetail();
      http.expectOne('/api/pages/g1').flush({ ...serverPage, ticketKey: 'BGT-3' });
      await settle();
      fixture.detectChanges();
      const snackSpy = jest.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue({} as never);

      screen.getByTestId('page-ticket-link').click();
      await settle();

      expect(writeText).toHaveBeenCalledWith(`${location.origin}/pages/BGT-3`);
      expect(snackSpy).toHaveBeenCalledWith('Copied link to BGT-3', undefined, { duration: 2000 });
    });

    it('says the copy failed when the clipboard rejects', async () => {
      Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('no')) } });
      const { http, fixture } = await renderDetail();
      http.expectOne('/api/pages/g1').flush({ ...serverPage, ticketKey: 'BGT-3' });
      await settle();
      fixture.detectChanges();
      const snackSpy = jest.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue({} as never);

      screen.getByTestId('page-ticket-key').click();
      await settle();

      expect(snackSpy).toHaveBeenCalledWith("Couldn't copy BGT-3", undefined, { duration: 2000 });
    });

    it('loads the page by GUID when the route holds its key', async () => {
      const { http, fixture } = await renderDetail({ guid: 'BGT-12' });
      await settle();
      http.expectOne('/api/ticket-keys/BGT-12').flush({ key: 'BGT-12', guid: 'g1', title: 'Page Title' });
      await settle();
      http.expectOne('/api/pages/g1').flush({ ...serverPage, ticketKey: 'BGT-12' });
      await settle();
      fixture.detectChanges();
      expect(TestBed.inject(PageContext).guid()).toBe('g1');
      expect(screen.getByTestId('page-ticket-key').textContent?.trim()).toBe('BGT-12');
    });

    it('keeps the key in the URL when toggling to edit', async () => {
      const { http } = await renderDetail({ guid: 'BGT-12' });
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await settle();
      http.expectOne('/api/ticket-keys/BGT-12').flush({ key: 'BGT-12', guid: 'g1', title: 'Page Title' });
      await settle();
      http.expectOne('/api/pages/g1').flush({ ...serverPage, ticketKey: 'BGT-12' });
      await settle();

      await userEvent.click(screen.getByRole('radio', { name: 'Edit' }));
      expect(navigate).toHaveBeenCalledWith(['/pages', 'BGT-12', 'edit']);
    });

    it('saves back to the key URL', async () => {
      const { http, fixture } = await renderDetail({ guid: 'BGT-12', editMode: true });
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await settle();
      http.expectOne('/api/ticket-keys/BGT-12').flush({ key: 'BGT-12', guid: 'g1', title: 'Page Title' });
      await settle();
      http.expectOne('/api/pages/g1').flush({ ...serverPage, ticketKey: 'BGT-12' });
      await settle();
      fixture.detectChanges();

      const save = fixture.componentInstance.save();
      await settle();
      http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1').flush({ ...serverPage, ticketKey: 'BGT-12' });
      await save;
      expect(navigate).toHaveBeenCalledWith(['/pages', 'BGT-12']);
    });

    it('shows a not-found state for an unknown key and loads nothing', async () => {
      const { http, fixture } = await renderDetail({ guid: 'NOPE-999' });
      await settle();
      http.expectOne('/api/ticket-keys/NOPE-999').flush({}, { status: 404, statusText: 'Not Found' });
      await settle();
      fixture.detectChanges();
      expect(screen.getByTestId('page-key-not-found').textContent).toContain('NOPE-999');
      http.expectNone((r) => r.url.startsWith('/api/pages/'));
    });

    it('shows no chip for an unkeyed page', async () => {
      const { http, fixture } = await renderDetail();
      http.expectOne('/api/pages/g1').flush(serverPage);
      await settle();
      fixture.detectChanges();
      expect(screen.queryByTestId('page-ticket-key')).toBeNull();
    });
  });

  // ---- Step 1b.3: PageContext channel (inspector hoisted to pages-view) ----

  it('publishes guid / metadata / mode to PageContext on load', async () => {
    const { http } = await renderDetail({ editMode: true });
    const ctx = TestBed.inject(PageContext);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    expect(ctx.guid()).toBe('g1');
    expect(ctx.mode()).toBe('edit');
    expect(ctx.metadata()?.title).toBe('Page Title');
    // page-detail's working copy IS the PageContext signal.
    expect(TestBed.inject(PageContext).metadata).toBe(ctx.metadata);
  });

  it('clears PageContext on destroy (reset())', async () => {
    const { http, fixture } = await renderDetail();
    const ctx = TestBed.inject(PageContext);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    expect(ctx.guid()).toBe('g1');

    fixture.destroy();

    expect(ctx.guid()).toBeNull();
    expect(ctx.metadata()).toBeNull();
  });

  it('a write to PageContext.metadata (the inspector metadataChange path) drives dirty-detection', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    const ctx = TestBed.inject(PageContext);
    ctx.metadata.update((m) => (m ? { ...m, title: 'Renamed' } : m));
    fixture.detectChanges();
    await settle();

    expect((fixture.componentInstance as unknown as { dirty: () => boolean }).dirty()).toBe(true);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('routes PageContext.emitInsert into the editor via insertMarkdownAtCursor', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'AB' });
    await settle();
    fixture.detectChanges();
    await settle();

    const comp = fixture.componentInstance as unknown as {
      insertMarkdownAtCursor: (m: string) => void;
    };
    const insertSpy = jest.spyOn(comp, 'insertMarkdownAtCursor');

    TestBed.inject(PageContext).emitInsert('![x](x.png)');
    await settle();
    fixture.detectChanges();

    expect(insertSpy).toHaveBeenCalledWith('![x](x.png)');
    expect(fixture.componentInstance.content()).toContain('![x](x.png)');
  });

  it('routes PageContext.emitTitleH1Sync into setFirstH1', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Original\n\nbody' });
    await settle();
    fixture.detectChanges();
    await settle();

    TestBed.inject(PageContext).emitTitleH1Sync('Renamed');
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toBe('# Renamed\n\nbody');
  });

  it('persists page type + merged properties immediately when PageContext.emitPageTypeChange fires, and invalidates page:<guid>', async () => {
    // The schema merge itself is covered in page-properties-panel.spec; here the
    // inspector is hoisted, so the merged PageTypeChange payload arrives over the
    // PageContext channel and page-detail must persist it at once.
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      properties: {
        status: { type: 'string', value: 'doing' },
        legacy: { type: 'string', value: 'x' },
      },
    });
    await settle();
    fixture.detectChanges();

    const bus = TestBed.inject(InvalidationBus);
    const before = bus.version(pageTag('g1'));

    const mergedProps: Record<string, PageProperty> = {
      status: { type: 'string', value: 'doing' },
      points: { type: 'number', value: '' },
      legacy: { type: 'string', value: 'x' },
    };
    TestBed.inject(PageContext).emitPageTypeChange({
      pageType: 'pt-task',
      properties: mergedProps,
    });
    await settle();

    const put = http.expectOne((r) => r.url === '/api/pages/g1' && r.method === 'PUT');
    expect(put.request.body).toEqual({ pageType: 'pt-task', properties: mergedProps });
    put.flush({ ...serverPage, pageType: 'pt-task', properties: mergedProps });
    await settle();

    expect(bus.version(pageTag('g1'))).toBe(before + 1);
  });

  it('clears the type only (no properties key) when "(none)" arrives over PageContext, and invalidates page:<guid>', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      pageType: 'pt-task',
      properties: { status: { type: 'string', value: 'doing' } },
    });
    await settle();
    fixture.detectChanges();

    const bus = TestBed.inject(InvalidationBus);
    const before = bus.version(pageTag('g1'));

    TestBed.inject(PageContext).emitPageTypeChange({ pageType: null });
    await settle();

    const put = http.expectOne((r) => r.url === '/api/pages/g1' && r.method === 'PUT');
    expect(put.request.body).toEqual({ pageType: null });
    // (none) clears only the type — no properties key is sent, so existing
    // server-side properties are left untouched.
    expect('properties' in (put.request.body as object)).toBe(false);
    put.flush({ ...serverPage, pageType: undefined });
    await settle();

    expect(bus.version(pageTag('g1'))).toBe(before + 1);
  });

  it('navigates to the edit route when the Edit toggle is clicked', async () => {
    const { http } = await renderDetail();
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    await userEvent.click(screen.getByRole('radio', { name: 'Edit' }));
    expect(navigate).toHaveBeenCalledWith(['/pages', 'g1', 'edit']);
  });

  it('renders the editor and a Save button in edit mode', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();
    expect(fixture.componentInstance.content()).toBe('# Original');
    expect(screen.getByRole('toolbar', { name: /markdown formatting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('prefers a local draft over server content in edit mode', async () => {
    localStorage.setItem(
      'bluefinwiki:draft:g1',
      JSON.stringify({
        content: '# Draft Content',
        metadata: {
          title: serverPage.title, tags: [], status: serverPage.status,
          createdBy: 'u', modifiedBy: 'u', createdAt: '', modifiedAt: '', guid: 'g1',
        },
      }),
    );
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    expect(fixture.componentInstance.content()).toBe('# Draft Content');
  });

  it('save() PUTs the current content and clears the draft', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    const drafts = TestBed.inject(Drafts);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    const req = http.expectOne('/api/pages/g1');
    expect(req.request.method).toBe('PUT');
    expect((req.request.body as { content: string }).content).toBe('# Edited');
    req.flush({ ...serverPage, content: '# Edited' });
    await settle();

    expect(drafts.hasDraft('g1')).toBe(false);
  });

  it('save() sends draft properties in their declared types (stale [] string, unset date)', async () => {
    // A draft written before the backend's empty-string parse fix carries
    // `state: []`; PUT /pages rejects a string property holding an array.
    localStorage.setItem(
      'bluefinwiki:draft:g1',
      JSON.stringify({
        content: '# Draft Content',
        metadata: {
          title: serverPage.title, tags: [], status: serverPage.status,
          properties: {
            state: { type: 'string', value: [] },
            due: { type: 'date', value: '' },
            genre: { type: 'tags', value: ['drama'] },
          },
          createdBy: 'u', modifiedBy: 'u', createdAt: '', modifiedAt: '', guid: 'g1',
        },
      }),
    );
    const { http, fixture } = await renderDetail({ editMode: true });
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    const req = http.expectOne('/api/pages/g1');
    expect((req.request.body as { properties: unknown }).properties).toEqual({
      state: { type: 'string', value: '' },
      genre: { type: 'tags', value: ['drama'] },
    });
    req.flush(serverPage);
    await settle();
  });

  it('routes an editor-action throw into EditorErrorState, not a snackbar', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    const state = TestBed.inject(EditorErrorState);
    (fixture.componentInstance as unknown as { editor: unknown }).editor = () => ({
      applyAction: () => {
        throw new Error('CM exploded');
      },
    });
    (fixture.componentInstance as unknown as { onAction: (a: unknown) => void }).onAction({
      type: 'bold',
    });
    expect(state.current()?.message).toContain('CM exploded');
  });

  it('renders Reload Page + reassurance in the editor-crash panel', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    TestBed.inject(EditorErrorState).setError('boom');
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    expect(screen.getByText(/saved to this browser/i)).toBeInTheDocument();
  });

  it('does not show the board toggle when the page has no boardConfig', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.queryByRole('radio', { name: /^board$/i })).toBeNull();
  });

  it('shows the board toggle in view mode when boardConfig.targetTypeGuid is set', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      boardConfig: { targetTypeGuid: 'pt-task', columns: ['Alpha'], defaultView: 'content' },
    });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('radio', { name: /^board$/i })).toBeInTheDocument();
  });

  // ---- Step 5.1: child-state auto-eligibility ----

  it('does not show the board toggle for a boardConfig without targetTypeGuid and no state-bearing children', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      boardConfig: { columns: ['Alpha'], defaultView: 'content' },
    });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.queryByRole('radio', { name: /^board$/i })).toBeNull();
  });

  it('opens the board when defaultView is board and the page is eligible', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      boardConfig: { targetTypeGuid: 'pt-task', columns: ['Alpha'], defaultView: 'board' },
    });
    await settle();
    // PageDetail and the mounted BoardView each fetch the page-type list.
    for (const req of http.match('/api/page-types')) req.flush({ pageTypes: [] });
    await settle();
    fixture.detectChanges();

    // The board view mounted: it is the only thing that fetches children with
    // the board's own page size.
    http.expectOne((req) => req.url.includes('/api/pages/g1/children') && req.url.includes('limit=200'))
      .flush({ children: [], hasMore: false });
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('radio', { name: /^board$/i })).toBeInTheDocument();
    expect(TestBed.inject(PageContext).boardView()).toBe(true);

    const refreshBtn = screen.getByRole('button', { name: /refresh board/i });
    expect(refreshBtn).toBeEnabled();
    await userEvent.click(refreshBtn);
    await settle();
    fixture.detectChanges();
    expect(refreshBtn).toBeDisabled();
    http.expectOne((req) => req.url.includes('/api/pages/g1/children') && req.url.includes('limit=200'))
      .flush({ children: [], hasMore: false });
    for (const req of http.match('/api/page-types')) req.flush({ pageTypes: [] });
    await settle();
    fixture.detectChanges();
    expect(refreshBtn).toBeEnabled();

    // The View/Edit toggle, Refresh, the info/inspector button, save status
    // and Save all act on this page's own content — none of them apply while
    // the Board view is showing a Kanban of its children instead.
    expect(screen.queryByRole('radio', { name: /^view$/i })).toBeNull();
    expect(screen.queryByRole('radio', { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^refresh$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /toggle inspector|page info/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();

    // Switching back to Content brings them all back.
    await userEvent.click(screen.getByRole('radio', { name: /^content$/i }));
    fixture.detectChanges();
    expect(TestBed.inject(PageContext).boardView()).toBe(false);
    expect(screen.getByRole('radio', { name: /^view$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle inspector|page info/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh board/i })).toBeNull();
  });

  it('falls back to content when defaultView is board but the page is no longer eligible', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      content: '# Original',
      // Saved while the page was eligible; its state-bearing children have
      // since been edited away, so `boardEligible()` is now false and the
      // Content|Board toggle is hidden. Rendering the board anyway would
      // strand the user on an empty board with no way back to the content.
      boardConfig: { columns: ['Alpha'], defaultView: 'board' },
    });
    await settle();
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    http.expectOne('/api/pages/g1/children?include=properties&limit=50').flush({
      children: [],
      hasMore: false,
    });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();

    expect(screen.queryByRole('radio', { name: /^board$/i })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Original' })).toBeInTheDocument();
    // The board view never mounted, so it never fetched its cards.
    http.expectNone((req) => req.url.includes('limit=200'));
    // Content is what is on screen, so the inspector must not be suppressed.
    expect(TestBed.inject(PageContext).boardView()).toBe(false);
  });

  it('shows the board toggle via child-state auto-eligibility with no boardConfig at all', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    http.expectOne('/api/page-types').flush({
      pageTypes: [
        {
          guid: 'pt-task',
          name: 'Task',
          icon: '✅',
          properties: [{ name: 'state', type: 'string', required: false }],
          allowedChildTypes: [],
          allowWikiPageChildren: false,
          allowedParentTypes: [],
          allowAnyParent: true,
          createdBy: 'u',
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    http.expectOne('/api/pages/g1/children?include=properties&limit=50').flush({
      children: [
        {
          guid: 'c1',
          title: 'Card',
          parentGuid: 'g1',
          status: 'published',
          modifiedAt: '2026-01-01T00:00:00Z',
          modifiedBy: 'u',
          hasChildren: false,
          pageType: 'pt-task',
          properties: { state: { type: 'string', value: 'To Do' } },
        },
      ],
      hasMore: false,
    });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('radio', { name: /^board$/i })).toBeInTheDocument();
  });

  it('does not show the board toggle when children of a state-bearing type all have an empty state value', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    http.expectOne('/api/page-types').flush({
      pageTypes: [
        {
          guid: 'pt-task',
          name: 'Task',
          icon: '✅',
          properties: [{ name: 'state', type: 'string', required: false }],
          allowedChildTypes: [],
          allowWikiPageChildren: false,
          allowedParentTypes: [],
          allowAnyParent: true,
          createdBy: 'u',
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    http.expectOne('/api/pages/g1/children?include=properties&limit=50').flush({
      children: [
        {
          guid: 'c1',
          title: 'Card',
          parentGuid: 'g1',
          status: 'published',
          modifiedAt: '2026-01-01T00:00:00Z',
          modifiedBy: 'u',
          hasChildren: false,
          pageType: 'pt-task',
          properties: { state: { type: 'string', value: '' } },
        },
      ],
      hasMore: false,
    });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.queryByRole('radio', { name: /^board$/i })).toBeNull();
  });

  // ---- Fix wave 2: the eligibility probe reloading must not eject the board ----

  /** A page type carrying a `state` property — the auto-eligibility trigger. */
  const stateBearingType = {
    guid: 'pt-task',
    name: 'Task',
    icon: '✅',
    properties: [{ name: 'state', type: 'string', required: false }],
    allowedChildTypes: [],
    allowWikiPageChildren: false,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: 'u',
    createdAt: '',
    updatedAt: '',
  };
  const stateCard = (state: string) => ({
    guid: 'c1',
    title: 'Card',
    parentGuid: 'g1',
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    pageType: 'pt-task',
    properties: { state: { type: 'string', value: state } },
  });

  it('keeps the board mounted and in Board view while a card PUT reloads the eligibility probe', async () => {
    const { http, fixture } = await renderDetail();
    // No boardConfig at all: eligibility comes purely from the child-state
    // probe, which is exactly the case that reloads on `children:any`.
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    http.expectOne('/api/page-types').flush({ pageTypes: [stateBearingType] });
    http.expectOne('/api/pages/g1/children?include=properties&limit=50').flush({
      children: [stateCard('To Do')],
      hasMore: false,
    });
    await settle();
    fixture.detectChanges();

    const comp = fixture.componentInstance as unknown as { viewMode: () => string };
    await userEvent.click(screen.getByRole('radio', { name: /^board$/i }));
    await settle();
    fixture.detectChanges();
    expect(comp.viewMode()).toBe('board');

    // The board mounted — it fetches its own page-type list and page one.
    for (const req of http.match('/api/page-types')) req.flush({ pageTypes: [stateBearingType] });
    http
      .expectOne((r) => r.url.includes('/api/pages/g1/children') && r.url.includes('limit=200'))
      .flush({ children: [stateCard('To Do')], hasMore: false });
    await settle();
    fixture.detectChanges();

    const board = fixture.debugElement.query(By.directive(BoardView));
    expect(board).not.toBeNull();

    // A drop / Card Summary save: a real PUT whose body carries `properties`,
    // so it bumps `children:any` and puts the eligibility probe back in flight.
    void TestBed.inject(Pages).updatePage('c1', {
      properties: { state: { type: 'string', value: 'Done' } },
    });
    await settle();
    http
      .expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/c1')
      .flush({ ...serverPage, guid: 'c1', folderId: 'g1' });
    await settle();
    fixture.detectChanges();

    // MID-RELOAD. The probe has no value right now; `boardEligible()` must not
    // read that as "no longer eligible" — tearing the board down here would
    // erase the optimistic patch, and the defaultView effect would silently
    // move the user to Content with no way back.
    expect(comp.viewMode()).toBe('board');
    const midBoard = fixture.debugElement.query(By.directive(BoardView));
    expect(midBoard).not.toBeNull();
    expect(midBoard.componentInstance).toBe(board.componentInstance);
    expect(screen.getByRole('radio', { name: /^board$/i })).toBeInTheDocument();

    // ...and once the probe lands again, still the same board instance.
    for (const req of http.match((r) => r.url.includes('include=properties'))) {
      req.flush({ children: [stateCard('Done')], hasMore: false });
    }
    await settle();
    fixture.detectChanges();

    expect(comp.viewMode()).toBe('board');
    expect(fixture.debugElement.query(By.directive(BoardView))?.componentInstance).toBe(
      board.componentInstance,
    );
  });

  it('stays in Board view with its cards rendered while refresh() reloads the page types', async () => {
    const { http, fixture } = await renderDetail();
    // Direct-children board with no targetTypeGuid: eligibility depends on
    // the page-type list (the child's type must carry `state`), so a cleared
    // list mid-reload would flip `boardEligible()` false.
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    http.expectOne('/api/page-types').flush({ pageTypes: [stateBearingType] });
    http.expectOne('/api/pages/g1/children?include=properties&limit=50').flush({
      children: [stateCard('To Do')],
      hasMore: false,
    });
    await settle();
    fixture.detectChanges();

    const comp = fixture.componentInstance as unknown as { viewMode: () => string };
    await userEvent.click(screen.getByRole('radio', { name: /^board$/i }));
    await settle();
    fixture.detectChanges();

    for (const req of http.match('/api/page-types')) req.flush({ pageTypes: [stateBearingType] });
    http
      .expectOne((r) => r.url.includes('/api/pages/g1/children') && r.url.includes('limit=200'))
      .flush({ children: [stateCard('To Do')], hasMore: false });
    await settle();
    fixture.detectChanges();

    const board = fixture.debugElement.query(By.directive(BoardView));
    expect(board).not.toBeNull();
    const boardView = board.componentInstance as BoardView;

    boardView.refresh();
    await settle();
    fixture.detectChanges();

    // MID-RELOAD: page types (page-detail's and the board's copies) and the
    // cards are back in flight. The cleared page-type list must not read as
    // "not eligible" and eject the user to Content.
    expect(comp.viewMode()).toBe('board');
    const midBoard = fixture.debugElement.query(By.directive(BoardView));
    expect(midBoard?.componentInstance).toBe(boardView);
    expect(boardView.refreshing()).toBe(true);
    expect(within(midBoard.nativeElement as HTMLElement).getByRole('button', { name: /card/i })).toBeInTheDocument();

    // ...and once everything lands, still the same board.
    for (const req of http.match('/api/page-types')) req.flush({ pageTypes: [stateBearingType] });
    for (const req of http.match((r) => r.url.includes('include=properties'))) {
      req.flush({ children: [stateCard('To Do')], hasMore: false });
    }
    await settle();
    fixture.detectChanges();
    expect(comp.viewMode()).toBe('board');
    expect(fixture.debugElement.query(By.directive(BoardView))?.componentInstance).toBe(boardView);
    expect(boardView.refreshing()).toBe(false);
  });

  it('opens Board settings with the previously loaded page types while the page types reload', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    http.expectOne('/api/page-types').flush({ pageTypes: [stateBearingType] });
    http.expectOne('/api/pages/g1/children?include=properties&limit=50').flush({
      children: [stateCard('To Do')],
      hasMore: false,
    });
    await settle();
    fixture.detectChanges();

    await userEvent.click(screen.getByRole('radio', { name: /^board$/i }));
    await settle();
    fixture.detectChanges();
    for (const req of http.match('/api/page-types')) req.flush({ pageTypes: [stateBearingType] });
    http
      .expectOne((r) => r.url.includes('/api/pages/g1/children') && r.url.includes('limit=200'))
      .flush({ children: [stateCard('To Do')], hasMore: false });
    await settle();
    fixture.detectChanges();

    // Refresh board puts the page-type resource back into 'loading'.
    (fixture.debugElement.query(By.directive(BoardView)).componentInstance as BoardView).refresh();
    await settle();
    fixture.detectChanges();
    expect(http.match('/api/page-types').length).toBeGreaterThan(0);

    const dialogOpen = jest
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(null) } as never);
    await (
      fixture.componentInstance as unknown as { openBoardSettings: () => Promise<void> }
    ).openBoardSettings();

    const opened = dialogOpen.mock.calls[0][1] as { data: { pageTypes: unknown[] } };
    expect(opened.data.pageTypes).toEqual([stateBearingType]);
  });

  it('saves the Board settings result config (not the { action, config } wrapper) as boardConfig', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    http.expectOne('/api/page-types').flush({ pageTypes: [stateBearingType] });
    await settle();
    fixture.detectChanges();

    jest
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of({ action: 'save', config: { columns: ['A'] } }) } as never);
    const done = (
      fixture.componentInstance as unknown as { openBoardSettings: () => Promise<void> }
    ).openBoardSettings();
    await settle();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
    expect((put.request.body as { boardConfig: unknown }).boardConfig).toEqual({ columns: ['A'] });
    put.flush(serverPage);
    await done;
  });

  // ---- Piece 4: board config defaults on page types ----

  const INITIATIVE = {
    guid: 'pt-init', name: 'Initiative', icon: '🎯',
    properties: [{ name: 'state', type: 'string', required: true }],
    allowedChildTypes: ['pt-task'], allowWikiPageChildren: false, allowedParentTypes: [], allowAnyParent: true,
    createdBy: 'someone-else', createdAt: '', updatedAt: '',
    boardDefaults: { leafTypes: true, defaultView: 'board' as const, columns: ['Ready', 'Done'] },
  };
  const TASK = { ...INITIATIVE, guid: 'pt-task', name: 'Task', icon: '✅', allowedChildTypes: [], boardDefaults: undefined };

  type BoardHost = {
    openBoardSettings: () => Promise<void>;
    boardConfig: () => unknown;
    viewMode: () => string;
  };

  /** Loads g1 as an Initiative page (optionally with its own boardConfig) and the type list. */
  async function loadInitiative(
    http: HttpTestingController,
    fixture: { detectChanges: () => void },
    page: Record<string, unknown> = {},
    types: unknown[] = [INITIATIVE, TASK],
  ): Promise<void> {
    http.expectOne('/api/pages/g1').flush({ ...serverPage, pageType: 'pt-init', ...page });
    await settle();
    for (const r of http.match('/api/page-types')) r.flush({ pageTypes: types });
    await settle();
    fixture.detectChanges();
  }

  function stubDialog(result: unknown) {
    return jest
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(result) } as never);
  }

  it('a page with no board settings of its own opens on its type-default board', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture);
    // The mounted board fetches its own page-type list first.
    for (const r of http.match('/api/page-types')) r.flush({ pageTypes: [INITIATIVE, TASK] });
    await settle();
    fixture.detectChanges();
    // Leaf mode resolves to Task → the board fetches it.
    http.expectOne((r) => r.url.includes('/api/pages/g1/children') && r.url.includes('type=pt-task'))
      .flush({ children: [], hasMore: false });
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('radio', { name: /^board$/i })).toBeChecked();
  });

  it('keeps the effective (type-default) board config while the page types reload', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture);
    const comp = fixture.componentInstance as unknown as BoardHost;
    const before = comp.boardConfig();
    expect(before).toEqual(INITIATIVE.boardDefaults);
    expect(comp.viewMode()).toBe('board');

    // Any page-type edit (or the board's Refresh) puts the type list back in flight.
    TestBed.inject(InvalidationBus).bump(pageTypesListTag());
    await settle();
    fixture.detectChanges();
    expect(http.match('/api/page-types').length).toBeGreaterThan(0);

    // MID-RELOAD: must not fall back to the page's own (null) config.
    expect(comp.boardConfig()).toEqual(before);
    expect(comp.viewMode()).toBe('board');
  });

  it('stays in Content after the user leaves a type-default board, across a page-types reload', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture);
    const comp = fixture.componentInstance as unknown as BoardHost;
    expect(comp.viewMode()).toBe('board');

    await userEvent.click(screen.getByRole('radio', { name: /^content$/i }));
    await settle();
    fixture.detectChanges();
    expect(comp.viewMode()).toBe('content');

    // A reload with the SAME defaults yields a new (but equal) effective
    // config object; that must not re-run the defaultView effect.
    TestBed.inject(InvalidationBus).bump(pageTypesListTag());
    await settle();
    // (The unmounted board's own page-type request was cancelled.)
    for (const r of http.match('/api/page-types').filter((x) => !x.cancelled)) {
      r.flush({ pageTypes: [{ ...INITIATIVE, boardDefaults: { ...INITIATIVE.boardDefaults } }, TASK] });
    }
    await settle();
    fixture.detectChanges();
    expect(comp.viewMode()).toBe('content');
  });

  it('opens Board settings with the effective config, type info and overridden groups', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture, { boardConfig: { columns: ['Mine'] } });
    const open = stubDialog(null);
    await (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
    const data = (open.mock.calls[0][1] as { data: Record<string, unknown> }).data;
    expect(data['config']).toEqual({ columns: ['Mine'], leafTypes: true, defaultView: 'board' });
    expect(data['type']).toEqual({ name: 'Initiative', icon: '🎯', hasDefaults: true, canEdit: true });
    expect(data['overridden']).toEqual(['columns']);
  });

  it('opens Board settings from the kept button while the page resource is in an error state', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture);
    TestBed.inject(InvalidationBus).bump(pageTag('g1'));
    await settle();
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await settle();
    fixture.detectChanges();
    const open = stubDialog(null);
    await userEvent.click(screen.getByRole('button', { name: /^board settings$/i }));
    await settle();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an Admin', { userId: 'u', role: 'Admin' as const }, true],
    ['the type creator', { userId: 'someone-else', role: 'Standard' as const }, true],
    ['anyone else', { userId: 'u', role: 'Standard' as const }, false],
  ])('computes canEdit for %s', async (_who, user, canEdit) => {
    const { http, fixture } = await renderDetail({ user });
    await loadInitiative(http, fixture);
    const open = stubDialog(null);
    await (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
    const data = (open.mock.calls[0][1] as { data: { type: { canEdit: boolean } } }).data;
    expect(data.type.canEdit).toBe(canEdit);
  });

  it('save stores only the groups that differ from the type defaults', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture);
    const open = stubDialog({ action: 'save', config: { columns: ['Todo'], leafTypes: true, defaultView: 'board' } });
    const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
    await settle();
    const data = (open.mock.calls[0][1] as { data: Record<string, unknown> }).data;
    expect(data['type']).toEqual({ name: 'Initiative', icon: '🎯', hasDefaults: true, canEdit: true });
    expect(data['overridden']).toEqual([]);
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
    expect((put.request.body as { boardConfig: unknown }).boardConfig).toEqual({ columns: ['Todo'] });
    put.flush({ ...serverPage, pageType: 'pt-init' });
    await done;
  });

  it('save in Direct-children mode does not write the hidden depth/title fields as overrides', async () => {
    const defaults = { leafTypes: true, depth: 5, showParentTitle: false, swapTitles: true, columns: ['Ready', 'Done'] };
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture, {}, [{ ...INITIATIVE, boardDefaults: defaults }, TASK]);
    // The panel hides depth / showParentTitle / swapTitles in Direct-children
    // mode, so its result may leave them out: that means "not applicable", not "off".
    stubDialog({ action: 'save', config: { columns: ['Ready', 'Done'] } });
    const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
    await settle();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
    expect((put.request.body as { boardConfig: unknown }).boardConfig).toEqual({ leafTypes: false });
    put.flush({ ...serverPage, pageType: 'pt-init' });
    await done;
  });

  it('reset clears the page board config so it follows the type defaults', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture, { boardConfig: { columns: ['Mine'] } });
    stubDialog({ action: 'reset', config: { columns: ['Mine'], leafTypes: true } });
    const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
    await settle();
    http.expectNone((r) => r.method === 'PUT' && r.url.startsWith('/api/page-types'));
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
    expect((put.request.body as { boardConfig: unknown }).boardConfig).toBeNull();
    put.flush({ ...serverPage, pageType: 'pt-init' });
    await done;
  });

  it('saveAsDefault writes the type defaults, then clears the page board config', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture, { boardConfig: { columns: ['Mine'] } });
    const config = { columns: ['Mine'], leafTypes: true, depth: 3, showParentTitle: true, defaultView: 'board' };
    stubDialog({ action: 'saveAsDefault', config });
    const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
    await settle();
    http.expectNone((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
    const typePut = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/page-types/pt-init');
    expect(typePut.request.body).toEqual({ boardDefaults: config });
    typePut.flush({ ...INITIATIVE, boardDefaults: config });
    await settle();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
    expect((put.request.body as { boardConfig: unknown }).boardConfig).toBeNull();
    put.flush({ ...serverPage, pageType: 'pt-init' });
    await done;
  });

  it('saveAsDefault asks first, and Cancel writes nothing', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture, { boardConfig: { columns: ['Mine'] } });
    const open = jest
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValueOnce({ afterClosed: () => of({ action: 'saveAsDefault', config: { columns: ['Mine'] } }) } as never)
      .mockReturnValueOnce({ afterClosed: () => of(false) } as never);
    await (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
    await settle();
    expect(open).toHaveBeenCalledTimes(2);
    expect((open.mock.calls[1][1] as { data: { message: string } }).data.message).toMatch(/every .*Initiative page/i);
    http.expectNone((r) => r.method === 'PUT');
  });

  it('Board settings stays disabled until the page types have loaded', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      pageType: 'pt-init',
      boardConfig: { targetTypeGuid: 'pt-task', defaultView: 'board' },
    });
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Board settings' })).toBeDisabled();

    for (const r of http.match('/api/page-types')) r.flush({ pageTypes: [INITIATIVE, TASK] });
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Board settings' })).toBeEnabled();
  });

  it('saveAsDefault says the defaults were saved when only clearing the page overrides fails', async () => {
    const { http, fixture } = await renderDetail();
    await loadInitiative(http, fixture, { boardConfig: { columns: ['Mine'] } });
    const snackSpy = jest.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue({} as never);
    const config = { columns: ['Mine'], leafTypes: true };
    stubDialog({ action: 'saveAsDefault', config });
    const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
    await settle();
    http.expectOne((r) => r.method === 'PUT' && r.url === '/api/page-types/pt-init')
      .flush({ ...INITIATIVE, boardDefaults: config });
    await settle();
    http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await done;
    expect(snackSpy).toHaveBeenCalledWith(
      "Saved the Initiative defaults, but couldn't clear this page's overrides.",
      'Dismiss',
      { duration: 4000 },
    );
  });

  describe('ticket key prefix (page-only)', () => {
    it('passes ticketKeys for an Initiative, with backfill rights for an Admin, and the saved prefix in config', async () => {
      const { http, fixture } = await renderDetail();
      await loadInitiative(http, fixture, { boardConfig: { keyPrefix: 'BGT' } });
      const open = stubDialog(null);
      await (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
      const data = (open.mock.calls[0][1] as { data: Record<string, unknown> }).data;
      expect(data['ticketKeys']).toEqual({ pageGuid: 'g1', canBackfill: true });
      expect((data['config'] as { keyPrefix?: string }).keyPrefix).toBe('BGT');
    });

    it('withholds backfill from non-Admins', async () => {
      const { http, fixture } = await renderDetail({ user: { userId: 'someone-else', role: 'Standard' } });
      await loadInitiative(http, fixture);
      const open = stubDialog(null);
      await (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
      const data = (open.mock.calls[0][1] as { data: Record<string, unknown> }).data;
      expect(data['ticketKeys']).toEqual({ pageGuid: 'g1', canBackfill: false });
    });

    it('passes no ticketKeys for a non-Initiative page', async () => {
      const { http, fixture } = await renderDetail();
      await loadInitiative(http, fixture, { pageType: 'pt-task' });
      const open = stubDialog(null);
      await (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
      const data = (open.mock.calls[0][1] as { data: Record<string, unknown> }).data;
      expect(data['ticketKeys']).toBeNull();
    });

    it('save keeps the prefix alongside the group overrides', async () => {
      const { http, fixture } = await renderDetail();
      await loadInitiative(http, fixture);
      stubDialog({ action: 'save', config: { keyPrefix: 'BGT', columns: ['Todo'], leafTypes: true, defaultView: 'board' } });
      const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
      await settle();
      const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
      expect((put.request.body as { boardConfig: unknown }).boardConfig).toEqual({ columns: ['Todo'], keyPrefix: 'BGT' });
      put.flush({ ...serverPage, pageType: 'pt-init' });
      await done;
    });

    it('save with only a prefix (matching defaults) stores just the prefix', async () => {
      const { http, fixture } = await renderDetail();
      await loadInitiative(http, fixture);
      stubDialog({ action: 'save', config: { keyPrefix: 'BGT', ...INITIATIVE.boardDefaults } });
      const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
      await settle();
      const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
      expect((put.request.body as { boardConfig: unknown }).boardConfig).toEqual({ keyPrefix: 'BGT' });
      put.flush({ ...serverPage, pageType: 'pt-init' });
      await done;
    });

    it('reset keeps the prefix', async () => {
      const { http, fixture } = await renderDetail();
      await loadInitiative(http, fixture, { boardConfig: { columns: ['Mine'], keyPrefix: 'BGT' } });
      stubDialog({ action: 'reset', config: { columns: ['Mine'], leafTypes: true, keyPrefix: 'BGT' } });
      const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
      await settle();
      const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
      expect((put.request.body as { boardConfig: unknown }).boardConfig).toEqual({ keyPrefix: 'BGT' });
      put.flush({ ...serverPage, pageType: 'pt-init' });
      await done;
    });

    it('saveAsDefault keeps the prefix off the type defaults and on the page', async () => {
      const { http, fixture } = await renderDetail();
      await loadInitiative(http, fixture, { boardConfig: { columns: ['Mine'], keyPrefix: 'BGT' } });
      const config = { columns: ['Mine'], leafTypes: true, defaultView: 'board' as const };
      stubDialog({ action: 'saveAsDefault', config: { ...config, keyPrefix: 'BGT' } });
      const done = (fixture.componentInstance as unknown as BoardHost).openBoardSettings();
      await settle();
      const typePut = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/page-types/pt-init');
      expect(typePut.request.body).toEqual({ boardDefaults: config });
      typePut.flush({ ...INITIATIVE, boardDefaults: config });
      await settle();
      const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1');
      expect((put.request.body as { boardConfig: unknown }).boardConfig).toEqual({ keyPrefix: 'BGT' });
      put.flush({ ...serverPage, pageType: 'pt-init' });
      await done;
    });
  });

  it('does not fetch page types when the page is in edit mode', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    // Board eligibility (and its `/api/page-types` fetch) only matters for the
    // view-mode Content|Board toggle — mounting the edit route should not pay
    // for it.
    http.expectNone('/api/page-types');
  });

  it('clears a stale editor-crash panel when a fresh page resolves', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    const state = TestBed.inject(EditorErrorState);
    // A crash on a previous page — EditorErrorState is root-scoped so it would
    // otherwise follow the user here.
    state.setError('stale boom');
    expect(state.current()).not.toBeNull();

    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();

    expect(state.current()).toBeNull();
    expect(
      (fixture.componentInstance as unknown as { editorError: () => unknown }).editorError(),
    ).toBeNull();
    expect(screen.queryByText(/the editor crashed/i)).toBeNull();
  });

  it('stashes the current draft before a hard page reload', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    const drafts = TestBed.inject(Drafts);
    const setSpy = jest.spyOn(drafts, 'set');
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Unsaved edit');
    fixture.detectChanges();
    await settle();
    setSpy.mockClear();

    // `window.location.reload` is non-configurable under jsdom; spy the seam.
    const comp = fixture.componentInstance as unknown as {
      hardReload: () => void;
      reloadPage: () => void;
    };
    const reload = jest.spyOn(comp, 'hardReload').mockImplementation(() => {});

    comp.reloadPage();

    expect(setSpy).toHaveBeenCalledWith('g1', expect.objectContaining({ content: '# Unsaved edit' }));
    expect(reload).toHaveBeenCalledTimes(1);
    // The stash ran before the reload.
    expect(setSpy.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
  });

  // ---- Step 3.1: Split view -------------------------------------------------

  const editorMode = (fixture: { componentInstance: unknown }): string =>
    (fixture.componentInstance as { editorMode: () => string }).editorMode();

  function draftJson(content: string): string {
    return JSON.stringify({
      content,
      metadata: {
        title: serverPage.title, tags: [], status: serverPage.status,
        createdBy: 'u', modifiedBy: 'u', createdAt: '', modifiedAt: '', guid: 'g1',
      },
    });
  }

  it('switches the editor surface between Edit / Split / Preview via the segmented control', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();

    expect(editorMode(fixture)).toBe('edit');

    await userEvent.click(screen.getByRole('radio', { name: 'Split' }));
    expect(editorMode(fixture)).toBe('split');

    await userEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(editorMode(fixture)).toBe('preview');

    await userEvent.click(screen.getByRole('radio', { name: 'Edit' }));
    expect(editorMode(fixture)).toBe('edit');
  });

  it('Split mode renders both the editor and the live preview side by side', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('radio', { name: 'Split' }));
    fixture.detectChanges();
    await settle();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.editor-surface.split')).toBeTruthy();
    expect(host.querySelector('wiki-codemirror')).toBeTruthy();
    expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
  });

  it('binds the Split left pane width to the persisted editorSplitPosition', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    await userEvent.click(screen.getByRole('radio', { name: 'Split' }));
    fixture.detectChanges();
    await settle();

    TestBed.inject(Layout).update({ editorSplitPosition: 35 });
    fixture.detectChanges();

    const pane = (fixture.nativeElement as HTMLElement)
      .querySelector('.editor-surface.split .editor-pane') as HTMLElement;
    expect(pane.style.flexBasis).toBe('35%');
  });

  it('maps the Split divider pointer X to an editorSplitPosition, clamped through the layout store', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    await userEvent.click(screen.getByRole('radio', { name: 'Split' }));
    fixture.detectChanges();
    await settle();

    const surface = (fixture.nativeElement as HTMLElement)
      .querySelector('.editor-surface') as HTMLElement;
    jest.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
      { left: 0, right: 1000, top: 0, bottom: 0, width: 1000, height: 0, x: 0, y: 0, toJSON: () => ({}) },
    );

    const layout = TestBed.inject(Layout);
    const updateSpy = jest.spyOn(layout, 'update');

    const divider = fixture.debugElement
      .query(By.css('.editor-surface'))
      .query(By.directive(ResizeDivider)).componentInstance as ResizeDivider;

    // 900 / 1000 = 90% -> outside the 20-80 band, so the store clamps to 80.
    divider.resized.emit(900);
    await settle();

    expect(updateSpy).toHaveBeenCalledWith({ editorSplitPosition: 90 });
    expect(layout.editorSplitPosition()).toBe(80);
  });

  it('updates the Split preview as the content buffer changes', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    await userEvent.click(screen.getByRole('radio', { name: 'Split' }));
    fixture.detectChanges();
    await settle();

    fixture.componentInstance.content.set('# Live Preview Heading');
    fixture.detectChanges();
    await settle();

    expect(screen.getByRole('heading', { name: 'Live Preview Heading' })).toBeInTheDocument();
  });

  it('opens in Split on load when a stored draft differs from the server content', async () => {
    localStorage.setItem('bluefinwiki:draft:g1', draftJson('# Diverged draft'));
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    expect(editorMode(fixture)).toBe('split');
  });

  it('does not open in Split when there is no draft', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    expect(editorMode(fixture)).toBe('edit');
  });

  it('does not open in Split when the stored draft equals the server content', async () => {
    localStorage.setItem('bluefinwiki:draft:g1', draftJson(serverPage.content));
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    expect(editorMode(fixture)).toBe('edit');
  });

  // ---- Step 3.2: Refresh button ------------------------------------------

  const dirty = (fixture: { componentInstance: unknown }): boolean =>
    (fixture.componentInstance as { dirty: () => boolean }).dirty();

  /** Let the MatDialog open/close animation settle so `afterClosed()` emits. */
  async function flushOverlay(): Promise<void> {
    await new Promise((r) => setTimeout(r, 250));
    await settle();
  }

  it('Refresh reloads the page immediately, with no prompt, when the buffer is clean', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();
    expect(dirty(fixture)).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await settle();

    // A clean buffer skips the confirm dialog entirely.
    expect(screen.queryByRole('dialog')).toBeNull();

    // resource.reload() issued a fresh GET (same affordance as the "Retry" link).
    const req = http.expectOne('/api/pages/g1');
    expect(req.request.method).toBe('GET');
    req.flush(serverPage);
    await settle();
    fixture.detectChanges();

    expect(dirty(fixture)).toBe(false);
  });

  it('Refresh prompts to confirm before discarding when there are unsaved changes', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Unsaved edit');
    fixture.detectChanges();
    await settle();
    expect(dirty(fixture)).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: /discard unsaved changes/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /discard & reload/i }),
    ).toBeInTheDocument();
    // Still no reload while the prompt is open.
    http.expectNone('/api/pages/g1');
  });

  it('Refresh on confirm clears the draft, reloads, and resets the dirty baseline', async () => {
    localStorage.setItem('bluefinwiki:draft:g1', draftJson('# Diverged draft'));
    const { http, fixture } = await renderDetail({ editMode: true });
    const drafts = TestBed.inject(Drafts);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    expect(dirty(fixture)).toBe(true);
    expect(drafts.hasDraft('g1')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /discard & reload/i }));
    await flushOverlay();

    // The draft survives until the GET succeeds (a failed GET must not lose it).
    expect(drafts.hasDraft('g1')).toBe(true);

    // The page resource refetched.
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();

    // Now the draft is gone from both the in-memory Map and localStorage.
    expect(drafts.hasDraft('g1')).toBe(false);
    expect(localStorage.getItem('bluefinwiki:draft:g1')).toBeNull();

    // Baseline reset to the freshly fetched server content.
    expect(fixture.componentInstance.content()).toBe('# Original');
    expect(dirty(fixture)).toBe(false);
  });

  it('Refresh on cancel changes nothing — no reload, draft and dirty state intact', async () => {
    localStorage.setItem('bluefinwiki:draft:g1', draftJson('# Diverged draft'));
    const { http, fixture } = await renderDetail({ editMode: true });
    const drafts = TestBed.inject(Drafts);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    expect(dirty(fixture)).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /keep editing/i }));
    await flushOverlay();

    // No refetch was triggered.
    http.expectNone('/api/pages/g1');
    expect(drafts.hasDraft('g1')).toBe(true);
    expect(fixture.componentInstance.content()).toBe('# Diverged draft');
    expect(dirty(fixture)).toBe(true);
  });

  it('Refresh resets the baseline via its own direct call, not the re-armed hydrate effect', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    // Dirty the buffer so we can watch the reset bring it back.
    fixture.componentInstance.content.set('# Local edit');
    fixture.detectChanges();
    await settle();
    expect(dirty(fixture)).toBe(true);

    const comp = fixture.componentInstance as unknown as {
      resetWorkingCopyToServer: (p: unknown) => void;
    };
    const resetSpy = jest.spyOn(comp, 'resetWorkingCopyToServer');
    // Freeze the hydrate effect's per-guid guard as permanently "already
    // synced" and swallow writes — simulating a future effect that no longer
    // re-hydrates on reload. Only refresh()'s own direct reset can restore the
    // baseline now; the transitive "re-arm syncedGuid + let the effect do it"
    // path is dead.
    Object.defineProperty(comp, 'syncedGuid', {
      configurable: true,
      get: () => 'g1',
      set: () => {
        /* swallow */
      },
    });

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /discard & reload/i }));
    await flushOverlay();

    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Reloaded from server' });
    await settle();
    fixture.detectChanges();
    await settle();

    expect(resetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ content: '# Reloaded from server' }),
    );
    expect(fixture.componentInstance.content()).toBe('# Reloaded from server');
    expect(dirty(fixture)).toBe(false);
  });

  it('Refresh ignores a second trigger while one refresh is already in flight', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Unsaved edit');
    fixture.detectChanges();
    await settle();
    expect(dirty(fixture)).toBe(true);

    const comp = fixture.componentInstance as unknown as { refresh: () => Promise<void> };
    // Rapid double trigger — the second must be dropped by the in-flight guard.
    void comp.refresh();
    void comp.refresh();
    await settle();

    // Exactly one confirm dialog, not two stacked.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    // The button is disabled while the refresh is pending.
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();

    // Cancel to let the in-flight refresh unwind cleanly.
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /keep editing/i }),
    );
    await flushOverlay();
    http.expectNone('/api/pages/g1');
  });

  it('Refresh re-enables itself even if the resource status stream never re-emits loading (I3)', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();

    const comp = fixture.componentInstance as unknown as {
      refresh: () => Promise<void>;
      isRefreshing: () => boolean;
      resource: { reload: () => void };
    };

    // Simulate the scheduler-coalescing hang: reload() never drives the status
    // stream through loading/reloading, so the `skipWhile` settle bridge would
    // never fire. Without the timeout race this wedges `_isRefreshing` true for
    // the life of the component.
    jest.spyOn(comp.resource, 'reload').mockImplementation(() => {});

    jest.useFakeTimers();
    try {
      const done = comp.refresh();
      expect(comp.isRefreshing()).toBe(true);

      await jest.advanceTimersByTimeAsync(10_000);
      await done;

      // The promise resolved and the guard released — Refresh is usable again.
      expect(comp.isRefreshing()).toBe(false);
      fixture.detectChanges();
      expect(screen.getByRole('button', { name: /refresh/i })).not.toBeDisabled();
    } finally {
      jest.useRealTimers();
    }
  });

  // ---- Step 3.3: Save-status pill + failure reassurance -----------------

  const REASSURANCE = /your changes are still here — click save again to retry\./i;

  it('shows the "Read-only" pill in view mode', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    drain();
    await settle();
    fixture.detectChanges();

    expect(screen.getByText(/^read-only$/i)).toBeInTheDocument();
    expect(screen.queryByText(/all changes saved/i)).toBeNull();
  });

  it('shows the "✓ All changes saved" pill in edit mode with a clean buffer', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();

    expect(dirty(fixture)).toBe(false);
    expect(screen.getByText(/all changes saved/i)).toBeInTheDocument();
  });

  it('shows the "● Unsaved changes" pill when the buffer is dirty', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Changed');
    fixture.detectChanges();
    await settle();

    expect(dirty(fixture)).toBe(true);
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    expect(screen.queryByText(/all changes saved/i)).toBeNull();
  });

  it('shows the "Saving…" pill while a save is in flight', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    fixture.detectChanges();

    expect(screen.getByText(/^saving…$/i)).toBeInTheDocument();

    // Resolve the in-flight PUT so the test tears down cleanly.
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Edited' });
    await settle();
  });

  it('reads "✓ All changes saved" again after a successful save', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();
    await settle();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Edited' });
    await settle();

    // updatePage bumps page:g1, so the resource refetches the saved content.
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Edited' });
    await settle();
    fixture.detectChanges();

    expect(dirty(fixture)).toBe(false);
    expect(screen.getByText(/all changes saved/i)).toBeInTheDocument();
  });

  it('shows a dismissible reassurance banner with the server message on save failure', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush(
      { message: 'Server on fire' },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();
    fixture.detectChanges();

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/save failed:/i);
    // Shows the server-supplied body message, not the framework error string.
    expect(banner).toHaveTextContent(/server on fire/i);
    expect(banner).toHaveTextContent(REASSURANCE);
    // The raw HttpErrorResponse.message (internal path + status) must not leak.
    expect(banner).not.toHaveTextContent(/http failure/i);
    expect(banner).not.toHaveTextContent('/api/pages/g1');
    // The old non-dismissible generic span is gone.
    expect(screen.queryByText('Save failed: Save failed. Try again.')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /dismiss save error/i }));
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('falls back to a sensible sentence when the server message is empty', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush(
      { message: '' },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();
    fixture.detectChanges();

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('Save failed: Save failed. Try again.');
    expect(banner).toHaveTextContent(REASSURANCE);
    expect(banner).not.toHaveTextContent(/http failure/i);
    // Never the empty "Save failed: ." sentence.
    expect(banner.textContent).not.toMatch(/save failed:\s*\./i);
  });

  it('returns the pill to "● Unsaved changes" after a failed save', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush(
      { message: 'nope' },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();
    fixture.detectChanges();

    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it('retains the draft on save failure (drafts.clear only on success)', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    const drafts = TestBed.inject(Drafts);
    const clearSpy = jest.spyOn(drafts, 'clear');
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush(
      { message: 'nope' },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();

    expect(clearSpy).not.toHaveBeenCalledWith('g1');
    expect(drafts.hasDraft('g1')).toBe(true);
  });

  it('re-arms the banner when a fresh save attempt is made after dismissing', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush(
      { message: 'first' },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();
    fixture.detectChanges();

    await userEvent.click(screen.getByRole('button', { name: /dismiss save error/i }));
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush(
      { message: 'second' },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();
    fixture.detectChanges();

    expect(screen.getByRole('alert')).toHaveTextContent(REASSURANCE);
  });

  // ---- Step 3.4: Toolbar Image + Attachment --------------------------------

  it('opens the attachment uploader when the toolbar attachment action fires', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();

    expect(fixture.debugElement.query(By.directive(AttachmentUploader))).toBeNull();

    (fixture.componentInstance as unknown as { onAction: (a: string) => void }).onAction('attachment');
    fixture.detectChanges();
    await settle();

    expect(fixture.debugElement.query(By.directive(AttachmentUploader))).not.toBeNull();
  });

  it('inserts the uploaded attachment markdown at the cursor via insertMarkdownAtCursor', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();

    const comp = fixture.componentInstance as unknown as {
      onAction: (a: string) => void;
      insertMarkdownAtCursor: (md: string) => void;
    };
    const insertSpy = jest.spyOn(comp, 'insertMarkdownAtCursor');

    comp.onAction('attachment');
    fixture.detectChanges();
    await settle();

    const uploader = fixture.debugElement.query(By.directive(AttachmentUploader))
      .componentInstance as AttachmentUploader;
    uploader.uploaded.emit({
      filename: 'Diagram.png',
      markdown: buildAttachmentMarkdown('Diagram.png', 'image/png'),
    });
    await settle();

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy.mock.calls[0][0]).toContain(buildAttachmentMarkdown('Diagram.png', 'image/png'));
  });

  it('insertMarkdownAtCursor writes the markdown into the editor buffer', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'AB' });
    await settle();
    fixture.detectChanges();
    await settle();

    (fixture.componentInstance as unknown as { insertMarkdownAtCursor: (m: string) => void })
      .insertMarkdownAtCursor('![x](x.png)');
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toContain('![x](x.png)');
  });

  it('insertMarkdownAtCursor from the Preview sub-mode flips to Split and still inserts (I1)', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'AB' });
    await settle();
    fixture.detectChanges();
    await settle();

    // Preview sub-mode: CodeMirror is unmounted.
    await userEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    fixture.detectChanges();
    await settle();
    expect(editorMode(fixture)).toBe('preview');
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-codemirror')).toBeNull();

    (fixture.componentInstance as unknown as { insertMarkdownAtCursor: (m: string) => void })
      .insertMarkdownAtCursor('![x](x.png)');
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await settle();

    // Action succeeded rather than being silently swallowed.
    expect(editorMode(fixture)).toBe('split');
    expect(fixture.componentInstance.content()).toContain('![x](x.png)');
  });

  // ---- Step 4.3: Title -> H1 sync ----------------------------------------

  const setFirstH1 = (fixture: { componentInstance: unknown }, t: string): void =>
    (fixture.componentInstance as { setFirstH1: (t: string) => void }).setFirstH1(t);

  it('setFirstH1 rewrites a leading # H1 in the editor buffer via a CM transaction', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Original\n\nbody' });
    await settle();
    fixture.detectChanges();
    await settle();

    setFirstH1(fixture, 'Renamed');
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toBe('# Renamed\n\nbody');
  });

  it('setFirstH1 leaves a non-H1 first line untouched', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'Just text\n# Later' });
    await settle();
    fixture.detectChanges();
    await settle();

    setFirstH1(fixture, 'Renamed');
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toBe('Just text\n# Later');
  });

  it('setFirstH1 does not loop — a repeat with the same title dispatches nothing', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Original\n\nbody' });
    await settle();
    fixture.detectChanges();
    await settle();

    const ed = (
      fixture.componentInstance as unknown as { editor: () => { replaceRange: (...a: unknown[]) => void } }
    ).editor();
    const spy = jest.spyOn(ed, 'replaceRange');

    setFirstH1(fixture, 'Renamed'); // one real rewrite
    await settle();
    setFirstH1(fixture, 'Renamed'); // H1 already correct -> no-op
    await settle();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.content()).toBe('# Renamed\n\nbody');
  });

  it('setFirstH1 rewrites the buffer directly (no mode flip) when CodeMirror is unmounted in Preview', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Original\n\nbody' });
    await settle();
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    fixture.detectChanges();
    await settle();
    expect(editorMode(fixture)).toBe('preview');
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-codemirror')).toBeNull();

    setFirstH1(fixture, 'Renamed');
    fixture.detectChanges();
    await settle();

    expect(fixture.componentInstance.content()).toBe('# Renamed\n\nbody');
    // A passive Title edit must not yank the surface out of Preview.
    expect(editorMode(fixture)).toBe('preview');
  });

  it('onImageResize rewrites the image at the reported document-order index', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '![hero](pic.png)' });
    await settle();
    fixture.detectChanges();
    await settle();

    (fixture.componentInstance as unknown as { onImageResize: (e: { index: number; width: number }) => void })
      .onImageResize({ index: 0, width: 250 });
    await settle();

    expect(fixture.componentInstance.content()).toBe('![hero|250](pic.png)');
  });

  it('onImageResize by index resizes only the dragged empty-alt image, not every ![](…)', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '![](a.png)\n\n![](b.png)' });
    await settle();
    fixture.detectChanges();
    await settle();

    (fixture.componentInstance as unknown as { onImageResize: (e: { index: number; width: number }) => void })
      .onImageResize({ index: 1, width: 120 });
    await settle();

    expect(fixture.componentInstance.content()).toBe('![](a.png)\n\n![|120](b.png)');
  });

  it('guards the toolbar attachment action when the page has no guid', async () => {
    const { fixture } = await renderDetail({ editMode: true, guid: '' });
    await settle();
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { onAction: (a: string) => void }).onAction('attachment');
    fixture.detectChanges();
    await settle();

    expect(screen.getByText(/save the page before uploading attachments\./i)).toBeInTheDocument();
    expect(fixture.debugElement.query(By.directive(AttachmentUploader))).toBeNull();
  });

  // ---- Step 3.8: resolveWikiTarget wiring --------------------------------

  const linkResolveResponse = (over: Record<string, unknown> = {}) => ({
    query: 'q',
    matches: [] as unknown[],
    exactMatch: false,
    ambiguous: false,
    exists: false,
    ...over,
  });

  it('provides resolveWikiTarget to the renderer; a resolved target drives the wiki-link href', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Real Page]].' });
    await settle();

    const rr = http.expectOne('/api/pages/links/resolve');
    expect(rr.request.method).toBe('POST');
    expect(rr.request.body).toEqual({ query: 'Real Page', maxResults: 1 });
    rr.flush(
      linkResolveResponse({
        query: 'Real Page',
        matches: [{ guid: 'guid-123', title: 'Real Page', parentGuid: null, status: 'published', confidence: 1, path: 'Real Page' }],
        exactMatch: true,
        exists: true,
      }),
    );
    await settle();
    drain();
    await settle();
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'wiki-link a.wiki-link',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/pages/guid-123');
  });

  it('applies all landing wiki-link resolutions in a single wikiResolutions write (I4)', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      content: 'See [[Alpha]], [[Bravo]] and [[Charlie]].',
    });
    await settle();

    const comp = fixture.componentInstance as unknown as {
      wikiResolutions: WritableSignal<ReadonlyMap<string, unknown>>;
    };

    // Spy the write path itself. The pre-fix code called `wikiResolutions.update`
    // once per resolved target (N writes -> N `resolveWikiTarget` identity flips
    // -> N full pipeline re-parses); the batched fix collects the whole landing
    // and applies exactly one `update`. This assertion is what actually
    // distinguishes the two — it fails (called 3x) if the batching hunk in
    // `resolveWikiTargets` is reverted.
    const updateSpy = jest.spyOn(comp.wikiResolutions, 'update');

    // Three distinct targets -> three POSTs, all in flight before any response.
    const reqs = http.match('/api/pages/links/resolve');
    expect(reqs).toHaveLength(3);
    reqs.forEach((r, i) =>
      r.flush(
        linkResolveResponse({
          matches: [{ guid: `g-${i}`, title: 't', parentGuid: null, status: 'published', confidence: 1, path: 't' }],
          exactMatch: true,
          exists: true,
        }),
      ),
    );
    await settle();
    drain();
    await settle();

    expect(comp.wikiResolutions().size).toBe(3);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    updateSpy.mockRestore();
  });

  it('opens the Create-Page-from-Link modal with the target prefilled when a broken wiki link is clicked', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Ghost Page]].' });
    await settle();

    const rr = http.expectOne('/api/pages/links/resolve');
    rr.flush(linkResolveResponse({ query: 'Ghost Page' }));
    await settle();
    drain();
    await settle();
    fixture.detectChanges();

    const broken = (fixture.nativeElement as HTMLElement).querySelector(
      'wiki-link a.wiki-link-broken',
    ) as HTMLElement;
    expect(broken).toBeTruthy();
    broken.click();
    await settle();

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: /create page from link/i }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText<HTMLInputElement>('Title').value).toBe('Ghost Page');
  });

  it('resolves a padded [[  Target  ]] to the same result as [[Target]]', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[  Real Page  ]].' });
    await settle();

    // Stored key and lookup key agree — one request, keyed by the trimmed target.
    const rr = http.expectOne('/api/pages/links/resolve');
    expect(rr.request.body).toEqual({ query: 'Real Page', maxResults: 1 });
    rr.flush(
      linkResolveResponse({
        query: 'Real Page',
        matches: [{ guid: 'guid-777', title: 'Real Page', parentGuid: null, status: 'published', confidence: 1, path: 'Real Page' }],
        exactMatch: true,
        exists: true,
      }),
    );
    await settle();
    drain();
    await settle();
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'wiki-link a.wiki-link',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/pages/guid-777');
  });

  it('degrades a wiki link to a non-broken, non-navigable link when the backend resolve fails', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Flaky Page]].' });
    await settle();

    const rr = http.expectOne('/api/pages/links/resolve');
    rr.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const link = host.querySelector('wiki-link a.wiki-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(host.querySelector('wiki-link a.wiki-link-broken')).toBeNull();
    // Plan-wide MUST: a failed resolve must NOT leave a navigable /pages/<title>
    // routerLink — the href stays absent until (if ever) a real guid resolves.
    expect(link.getAttribute('href')).toBeNull();
    expect(link.getAttribute('href')).not.toBe('/pages/Flaky%20Page');
  });

  it('clears the wiki-resolution cache when the route guid changes', async () => {
    const paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ guid: 'gA' }));
    const { fixture } = await render(PageDetail, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$, data: of({}) } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    http.expectOne('/api/pages/gA').flush({ ...serverPage, guid: 'gA', content: 'See [[Foo]].' });
    await settle();

    const rrA = http.expectOne('/api/pages/links/resolve');
    expect(rrA.request.body).toEqual({ query: 'Foo', maxResults: 1 });
    rrA.flush(linkResolveResponse({ query: 'Foo' })); // exactMatch:false -> broken
    await settle();
    drain();
    await settle();

    const comp = fixture.componentInstance as unknown as {
      wikiResolutions: () => ReadonlyMap<string, unknown>;
      wikiResolveInFlight: Set<string>;
    };
    expect(comp.wikiResolutions().size).toBe(1);

    // Navigate to page B on the SAME component instance.
    paramMap$.next(convertToParamMap({ guid: 'gB' }));
    await settle();

    // Stale broken entry is gone — not served on the return visit.
    expect(comp.wikiResolutions().size).toBe(0);

    http.expectOne('/api/pages/gB').flush({ ...serverPage, guid: 'gB', content: 'See [[Foo]].' });
    await settle();

    // [[Foo]] is re-resolved against page B rather than blocked by the old
    // `known.has('Foo')` guard.
    const rrB = http.expectOne('/api/pages/links/resolve');
    expect(rrB.request.body).toEqual({ query: 'Foo', maxResults: 1 });
    rrB.flush(linkResolveResponse({ query: 'Foo' }));
    await settle();
    drain();
  });

  // ---- Step 4.1: Inspector layout binding --------------------------------

  it('toggling the inspector writes inspectorVisible through the Layout store', async () => {
    const { http } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    const layout = TestBed.inject(Layout);
    const updateSpy = jest.spyOn(layout, 'update');
    expect(layout.inspectorVisible()).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    await settle();

    expect(updateSpy).toHaveBeenCalledWith({ inspectorVisible: true });
    expect(layout.inspectorVisible()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    await settle();

    expect(updateSpy).toHaveBeenLastCalledWith({ inspectorVisible: false });
    expect(layout.inspectorVisible()).toBe(false);
  });

  it('writes the inspector open state to the persisted Layout store (localStorage)', async () => {
    const first = await renderDetail();
    first.http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    await settle();
    expect(TestBed.inject(Layout).inspectorVisible()).toBe(true);

    // Layout persists to localStorage on every update; a later fresh mount of the
    // providedIn:'root' service would hydrate this flag back (covered by the
    // open-on-mount test above).
    const stored = JSON.parse(
      localStorage.getItem('bluefinwiki-layout') ?? '{}',
    ) as { inspectorVisible?: boolean };
    expect(stored.inspectorVisible).toBe(true);
  });

  // The inspector's on-mount rendering, width style and presentation seam moved
  // to `pages-view` with the hoist (step 1b.3); their assertions now live in
  // pages-view.spec.ts. The responsive sidenav open/width wiring is step 1b.5.

  // ---- Step 1b.5: the editor-bar inspector control adapts to the breakpoint ----

  it('desktop: the editor-bar inspector control is the "Toggle inspector" button and calls toggleInspector()', async () => {
    const { http } = await renderDetail(); // provideBreakpointStub(true) by default
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    const toggleSpy = jest.spyOn(TestBed.inject(PageContext), 'toggleInspector');
    const btn = screen.getByRole('button', { name: /toggle inspector/i });
    expect(screen.queryByRole('button', { name: /page info/i })).toBeNull();

    await userEvent.click(btn);
    expect(toggleSpy).toHaveBeenCalled();
  });

  it('mobile: the editor-bar inspector control is an info button and calls toggleInspector()', async () => {
    const { http } = await renderDetail({ isDesktop: false });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    const toggleSpy = jest.spyOn(TestBed.inject(PageContext), 'toggleInspector');
    const btn = screen.getByRole('button', { name: /page info/i });
    expect(screen.queryByRole('button', { name: /toggle inspector/i })).toBeNull();

    await userEvent.click(btn);
    expect(toggleSpy).toHaveBeenCalled();
  });

  // ---- Step 1b.6: editor bar + markdown toolbar responsive ----

  it('mobile: the editor mode toggle offers Edit and Preview but not Split', async () => {
    const { http } = await renderDetail({ editMode: true, isDesktop: false });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    expect(screen.getByRole('radio', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Split' })).toBeNull();
  });

  it('desktop: the editor mode toggle keeps all three of Edit / Split / Preview', async () => {
    const { http } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    expect(screen.getByRole('radio', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Split' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Preview' })).toBeInTheDocument();
  });

  it('falls back from Split to Edit when the viewport drops below desktop', async () => {
    const { http, fixture, bpStub } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    await userEvent.click(screen.getByRole('radio', { name: 'Split' }));
    expect(editorMode(fixture)).toBe('split');

    bpStub.isDesktop.set(false);
    fixture.detectChanges();
    await settle();

    expect(editorMode(fixture)).toBe('edit');
    expect(screen.queryByRole('radio', { name: 'Split' })).toBeNull();
  });

  it('mobile: drives the markdown toolbar compact + bottom-pinned; desktop leaves it inline', async () => {
    const { http, fixture, bpStub } = await renderDetail({ editMode: true, isDesktop: false });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const toolbar = host.querySelector('wiki-markdown-toolbar') as HTMLElement;
    expect(toolbar).toBeTruthy();
    expect(toolbar.classList).toContain('bottom-pinned');
    expect(host.querySelector('.body.toolbar-pinned')).toBeTruthy();

    bpStub.isDesktop.set(true);
    fixture.detectChanges();
    await settle();

    expect((host.querySelector('wiki-markdown-toolbar') as HTMLElement).classList)
      .not.toContain('bottom-pinned');
    expect(host.querySelector('.body.toolbar-pinned')).toBeNull();
  });

  it('mobile: the bottom-toolbar reserve (.body.toolbar-pinned) is released in the Preview sub-mode (review M4)', async () => {
    const { http, fixture } = await renderDetail({ editMode: true, isDesktop: false });
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    // Edit sub-mode: the toolbar is pinned, so .body reserves space for it.
    expect(host.querySelector('.body.toolbar-pinned')).toBeTruthy();

    await userEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    // Preview: the toolbar is not rendered, so the reserve class is dropped
    // (toolbarPinned()'s `editorMode() !== 'preview'` conjunct).
    expect(editorMode(fixture)).toBe('preview');
    expect(host.querySelector('.body.toolbar-pinned')).toBeNull();
  });

  // ---- Step 1b.8: the TOC compact input tracks !bp.isDesktop() ----

  it('drives the wiki-toc compact input from !bp.isDesktop() and reflects a flip', async () => {
    const { http, fixture, bpStub } = await renderDetail({ isDesktop: false });
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      content: '## Alpha\n\n## Beta\n\n## Gamma',
    });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();

    const toc = fixture.debugElement.query(By.directive(WikiTableOfContents));
    expect(toc).toBeTruthy();
    const tocCmp = toc.componentInstance as WikiTableOfContents;
    // Mobile: compact.
    expect(tocCmp.compact()).toBe(true);

    // Flip to desktop -> rail.
    bpStub.isDesktop.set(true);
    fixture.detectChanges();
    await settle();
    expect(tocCmp.compact()).toBe(false);
  });

  // ---- Step 2.7: Create-Page-from-Link source-markdown rewrite -----------

  interface BrokenLinkResult { newGuid: string; linkText: string; originalTarget: string }
  interface BrokenLinkHandle {
    onBrokenLink: (e: { target: string; displayText: string }) => Promise<void>;
  }

  function stubBrokenLinkDialog(result: BrokenLinkResult | null): jest.SpyInstance {
    const dialog = TestBed.inject(MatDialog);
    return jest.spyOn(dialog, 'open').mockReturnValue({ afterClosed: () => of(result) } as never);
  }

  it('rewrites [[target]] to [[newGuid|target]] via a CM transaction and marks the buffer dirty', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Ghost Page]] here.' });
    await settle();
    fixture.detectChanges();
    await settle();

    stubBrokenLinkDialog({ newGuid: 'new-guid', linkText: 'Ghost Page', originalTarget: 'Ghost Page' });
    const ed = (
      fixture.componentInstance as unknown as { editor: () => { replaceRange: (...a: unknown[]) => void } }
    ).editor();
    const replaceSpy = jest.spyOn(ed, 'replaceRange');

    await (fixture.componentInstance as unknown as BrokenLinkHandle).onBrokenLink({
      target: 'Ghost Page',
      displayText: 'Ghost Page',
    });
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toBe('See [[new-guid|Ghost Page]] here.');
    // A multi-occurrence rewrite can't be expressed as one CodeMirror range,
    // so the whole buffer is swapped in a single `replaceRange` call — one
    // dispatch, one undo step — rather than per-occurrence dispatches.
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledWith(0, 'See [[Ghost Page]] here.'.length, 'See [[new-guid|Ghost Page]] here.');
    expect((fixture.componentInstance as unknown as { dirty: () => boolean }).dirty()).toBe(true);
  });

  it('rewrites every occurrence of a repeated broken target', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      content: '[[Ghost]] and again [[Ghost|alias]].',
    });
    await settle();
    fixture.detectChanges();
    await settle();

    stubBrokenLinkDialog({ newGuid: 'new-guid', linkText: 'Ghost', originalTarget: 'Ghost' });
    await (fixture.componentInstance as unknown as BrokenLinkHandle).onBrokenLink({
      target: 'Ghost',
      displayText: 'Ghost',
    });
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toBe('[[new-guid|Ghost]] and again [[new-guid|alias]].');
  });

  it('leaves a different [[target]] untouched', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '[[Ghost]] and [[Other]].' });
    await settle();
    fixture.detectChanges();
    await settle();

    stubBrokenLinkDialog({ newGuid: 'new-guid', linkText: 'Ghost', originalTarget: 'Ghost' });
    await (fixture.componentInstance as unknown as BrokenLinkHandle).onBrokenLink({
      target: 'Ghost',
      displayText: 'Ghost',
    });
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toBe('[[new-guid|Ghost]] and [[Other]].');
  });

  it('shows the "save the page" hint via the snackbar after a successful rewrite', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Ghost Page]] here.' });
    await settle();
    fixture.detectChanges();
    await settle();

    stubBrokenLinkDialog({ newGuid: 'new-guid', linkText: 'Ghost Page', originalTarget: 'Ghost Page' });
    const snack = TestBed.inject(MatSnackBar);
    const snackSpy = jest.spyOn(snack, 'open').mockReturnValue({} as never);

    await (fixture.componentInstance as unknown as BrokenLinkHandle).onBrokenLink({
      target: 'Ghost Page',
      displayText: 'Ghost Page',
    });
    await settle();

    expect(snackSpy).toHaveBeenCalledWith(
      'Link updated — save the page to keep the change.',
      'Dismiss',
      { duration: 4000 },
    );
  });

  it('does not auto-save after the rewrite — no PUT is fired', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Ghost Page]] here.' });
    await settle();
    fixture.detectChanges();
    await settle();

    stubBrokenLinkDialog({ newGuid: 'new-guid', linkText: 'Ghost Page', originalTarget: 'Ghost Page' });
    await (fixture.componentInstance as unknown as BrokenLinkHandle).onBrokenLink({
      target: 'Ghost Page',
      displayText: 'Ghost Page',
    });
    await settle();

    expect(http.match((req) => req.method === 'PUT')).toHaveLength(0);
  });

  it('does nothing when the modal is cancelled (result is null)', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Ghost Page]] here.' });
    await settle();
    fixture.detectChanges();
    await settle();

    stubBrokenLinkDialog(null);
    const snack = TestBed.inject(MatSnackBar);
    const snackSpy = jest.spyOn(snack, 'open').mockReturnValue({} as never);

    await (fixture.componentInstance as unknown as BrokenLinkHandle).onBrokenLink({
      target: 'Ghost Page',
      displayText: 'Ghost Page',
    });
    await settle();

    expect(fixture.componentInstance.content()).toBe('See [[Ghost Page]] here.');
    expect(snackSpy).not.toHaveBeenCalled();
  });

  it('rewrites the buffer directly (no CM dispatch) when CodeMirror is unmounted in Preview', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Ghost Page]] here.' });
    await settle();
    fixture.detectChanges();
    await settle();

    await userEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    fixture.detectChanges();
    await settle();
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-codemirror')).toBeNull();

    stubBrokenLinkDialog({ newGuid: 'new-guid', linkText: 'Ghost Page', originalTarget: 'Ghost Page' });
    await (fixture.componentInstance as unknown as BrokenLinkHandle).onBrokenLink({
      target: 'Ghost Page',
      displayText: 'Ghost Page',
    });
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toBe('See [[new-guid|Ghost Page]] here.');
  });

  it('passes the raw wiki-link target (not the display text) as originalTarget to the modal', async () => {
    const { http, fixture } = await renderDetail({ editMode: true });
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: 'See [[Ghost Page|alias]] here.' });
    await settle();
    fixture.detectChanges();
    await settle();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = jest
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(null) } as never);

    await (fixture.componentInstance as unknown as BrokenLinkHandle).onBrokenLink({
      target: 'Ghost Page',
      displayText: 'alias',
    });
    await settle();

    const call = openSpy.mock.calls[0] as [unknown, { data: { target: string; originalTarget: string } }];
    expect(call[1].data.target).toBe('alias');
    expect(call[1].data.originalTarget).toBe('Ghost Page');
  });

  // ---- Piece 5: realtime — publish dirty, "changed elsewhere" banner ----

  describe('changed elsewhere', () => {
    const BANNER = /this page was changed elsewhere\./i;

    /** Load g1 and let the hydrate effect run; returns the component handle. */
    async function load(opts: { editMode?: boolean; page?: Record<string, unknown> } = {}) {
      const r = await renderDetail({ editMode: opts.editMode ?? true });
      r.http.expectOne('/api/pages/g1').flush({ ...serverPage, ...opts.page });
      await settle();
      r.fixture.detectChanges();
      await settle();
      return r;
    }

    /** A realtime `page:g1` bump (live message or reconnect catch-up). */
    async function bumpPage(fixture: { detectChanges: () => void }): Promise<void> {
      TestBed.inject(InvalidationBus).bump(pageTag('g1'));
      await settle();
      fixture.detectChanges();
    }

    async function typeEdit(fixture: { componentInstance: PageDetail; detectChanges: () => void }, text: string) {
      fixture.componentInstance.content.set(text);
      fixture.detectChanges();
      await settle();
    }

    it('publishes dirty to PageContext while an edit is unsaved', async () => {
      const { fixture } = await load();
      const ctx = TestBed.inject(PageContext);
      expect(ctx.dirty()).toBe(false);

      await typeEdit(fixture, '# Unsaved edit');

      expect(ctx.dirty()).toBe(true);
    });

    it('shows the banner with Reload and Dismiss when remoteChange is set', async () => {
      const { fixture } = await load();

      TestBed.inject(PageContext).remoteChange.set(true);
      fixture.detectChanges();

      const banner = screen.getByText(BANNER).closest('[role="status"]') as HTMLElement;
      expect(banner).not.toBeNull();
      expect(within(banner).getByRole('button', { name: /^reload$/i })).toBeInTheDocument();
      expect(within(banner).getByRole('button', { name: /^dismiss$/i })).toBeInTheDocument();
    });

    it('Dismiss hides the banner, clears remoteChange and leaves the draft untouched', async () => {
      const { fixture, http } = await load();
      const ctx = TestBed.inject(PageContext);
      await typeEdit(fixture, '# My draft');
      ctx.remoteChange.set(true);
      fixture.detectChanges();

      await userEvent.click(screen.getByRole('button', { name: /^dismiss$/i }));
      await settle();
      fixture.detectChanges();

      expect(screen.queryByText(BANNER)).toBeNull();
      expect(ctx.remoteChange()).toBe(false);
      expect(fixture.componentInstance.content()).toBe('# My draft');
      http.expectNone('/api/pages/g1');
    });

    it('Reload refetches with no confirm dialog, resets the working copy and hides the banner', async () => {
      const { fixture, http } = await load();
      const ctx = TestBed.inject(PageContext);
      await typeEdit(fixture, '# My draft');
      ctx.remoteChange.set(true);
      fixture.detectChanges();

      await userEvent.click(screen.getByRole('button', { name: /^reload$/i }));
      await settle();

      // The user already chose Reload: no "Discard unsaved changes?" prompt.
      expect(screen.queryByRole('dialog')).toBeNull();
      const req = http.expectOne('/api/pages/g1');
      expect(req.request.method).toBe('GET');
      req.flush({ ...serverPage, content: '# Theirs', modifiedAt: '2026-02-02T00:00:00Z' });
      await settle();
      fixture.detectChanges();
      await settle();

      expect(screen.queryByText(BANNER)).toBeNull();
      expect(ctx.remoteChange()).toBe(false);
      expect(fixture.componentInstance.content()).toBe('# Theirs');
      expect(ctx.dirty()).toBe(false);
    });

    it('the banner survives a dirty -> clean transition on the same guid', async () => {
      const { fixture } = await load();
      const ctx = TestBed.inject(PageContext);
      await typeEdit(fixture, '# My draft');
      ctx.remoteChange.set(true);
      fixture.detectChanges();

      await typeEdit(fixture, serverPage.content); // back to clean
      expect(ctx.dirty()).toBe(false);

      expect(ctx.remoteChange()).toBe(true);
      expect(screen.getByText(BANNER)).toBeInTheDocument();
    });

    it('clears remoteChange when the route guid changes', async () => {
      const paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ guid: 'gA' }));
      await render(PageDetail, {
        providers: [
          provideAnimationsAsync(),
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { paramMap: paramMap$, data: of({ editMode: true }) } },
        ],
      });
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/pages/gA').flush({ ...serverPage, guid: 'gA' });
      await settle();
      const ctx = TestBed.inject(PageContext);
      ctx.remoteChange.set(true);
      await settle();
      expect(ctx.remoteChange()).toBe(true);

      paramMap$.next(convertToParamMap({ guid: 'gB' }));
      await settle();

      expect(ctx.remoteChange()).toBe(false);
    });

    it('a live update of a clean page re-syncs the working copy and stashes no draft', async () => {
      const { fixture, http } = await load({ editMode: false });

      await bumpPage(fixture);
      http.expectOne('/api/pages/g1').flush({
        ...serverPage,
        content: '# Changed elsewhere',
        modifiedAt: '2026-02-02T00:00:00Z',
      });
      await settle();
      fixture.detectChanges();
      await settle();

      expect(fixture.componentInstance.content()).toBe('# Changed elsewhere');
      expect(screen.getByRole('heading', { name: /changed elsewhere/i })).toBeInTheDocument();
      expect((fixture.componentInstance as unknown as { dirty: () => boolean }).dirty()).toBe(false);
      expect(TestBed.inject(PageContext).remoteChange()).toBe(false);

      fixture.destroy();
      expect(TestBed.inject(Drafts).hasDraft('g1')).toBe(false);
    });

    it('a reload of a dirty page with a changed modifiedAt raises the banner and keeps the draft', async () => {
      const { fixture, http } = await load();
      const ctx = TestBed.inject(PageContext);
      await typeEdit(fixture, '# My draft');

      // e.g. the reconnect catch-up, which always bumps the open page.
      await bumpPage(fixture);
      http.expectOne('/api/pages/g1').flush({
        ...serverPage,
        content: '# Theirs',
        modifiedAt: '2026-02-02T00:00:00Z',
      });
      await settle();
      fixture.detectChanges();
      await settle();

      expect(ctx.remoteChange()).toBe(true);
      expect(screen.getByText(BANNER)).toBeInTheDocument();
      expect(fixture.componentInstance.content()).toBe('# My draft');
      expect(ctx.dirty()).toBe(true);
    });

    it('a reload of a dirty page with an unchanged modifiedAt raises no banner and keeps the draft', async () => {
      const { fixture, http } = await load();
      const ctx = TestBed.inject(PageContext);
      await typeEdit(fixture, '# My draft');

      await bumpPage(fixture);
      http.expectOne('/api/pages/g1').flush(serverPage);
      await settle();
      fixture.detectChanges();
      await settle();

      expect(ctx.remoteChange()).toBe(false);
      expect(screen.queryByText(BANNER)).toBeNull();
      expect(fixture.componentInstance.content()).toBe('# My draft');
      expect(ctx.dirty()).toBe(true);
    });

    it('dirty stays published as true while the page reloads', async () => {
      const { fixture, http } = await load();
      const ctx = TestBed.inject(PageContext);
      await typeEdit(fixture, '# My draft');
      expect(ctx.dirty()).toBe(true);

      await bumpPage(fixture);
      await settle();

      // MID-RELOAD: the GET is pending. Flipping to false here would stop
      // Realtime holding back live page:<guid> messages.
      const req = http.expectOne('/api/pages/g1');
      expect(ctx.dirty()).toBe(true);
      req.flush(serverPage);
      await settle();
      expect(ctx.dirty()).toBe(true);
    });

    it("this tab's own page-type change on a dirty page raises no banner", async () => {
      const { fixture, http } = await load();
      const ctx = TestBed.inject(PageContext);
      await typeEdit(fixture, '# My draft');

      ctx.emitPageTypeChange({ pageType: 'pt-task', properties: {} });
      await settle();
      const saved = { ...serverPage, pageType: 'pt-task', modifiedAt: '2026-03-03T00:00:00Z' };
      http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1').flush(saved);
      await settle();
      http.expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1').flush(saved);
      await settle();
      fixture.detectChanges();

      expect(ctx.remoteChange()).toBe(false);
      expect(fixture.componentInstance.content()).toBe('# My draft');
    });

    it('an own page-type write that carries a remote content change still raises the banner', async () => {
      const { fixture, http } = await load();
      const ctx = TestBed.inject(PageContext);
      await typeEdit(fixture, '# My draft');

      ctx.emitPageTypeChange({ pageType: 'pt-task', properties: {} });
      await settle();
      // Someone else's edit landed between our base and this partial write.
      const saved = { ...serverPage, content: '# Theirs', pageType: 'pt-task', modifiedAt: '2026-03-03T00:00:00Z' };
      http.expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1').flush(saved);
      await settle();
      http.expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1').flush(saved);
      await settle();
      fixture.detectChanges();

      expect(ctx.remoteChange()).toBe(true);
      expect(fixture.componentInstance.content()).toBe('# My draft');
    });

    it('a successful save re-baselines at once, so nothing is stashed while the page reloads', async () => {
      const { fixture, http } = await load();
      jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await typeEdit(fixture, '# Edited');

      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
      http
        .expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1')
        .flush({ ...serverPage, content: '# Edited', modifiedAt: '2026-03-03T00:00:00Z' });
      await settle();

      // The reload GET is still pending (the route change would destroy us here).
      http.expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1');
      expect(TestBed.inject(PageContext).dirty()).toBe(false);
      fixture.destroy();
      expect(TestBed.inject(Drafts).hasDraft('g1')).toBe(false);
    });

    it('keeps the same CodeMirror mounted through a page:g1 reload in edit mode', async () => {
      const { fixture, http } = await load();
      await typeEdit(fixture, '# My draft');
      const editorEl = (fixture.nativeElement as HTMLElement).querySelector('wiki-codemirror');
      expect(editorEl).not.toBeNull();

      await bumpPage(fixture); // e.g. the reconnect catch-up after a tab switch
      await settle();
      fixture.detectChanges();

      // MID-RELOAD: no "Loading page..." swap, the very same editor element.
      const req = http.expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1');
      expect(screen.queryByText(/loading page/i)).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('wiki-codemirror')).toBe(editorEl);

      req.flush(serverPage);
      await settle();
      fixture.detectChanges();
      await settle();
      expect((fixture.nativeElement as HTMLElement).querySelector('wiki-codemirror')).toBe(editorEl);
      expect(fixture.componentInstance.content()).toBe('# My draft');
    });

    it('still shows the loading state when the route guid changes', async () => {
      const paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ guid: 'gA' }));
      const { fixture } = await render(PageDetail, {
        providers: [
          provideAnimationsAsync(),
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { paramMap: paramMap$, data: of({ editMode: true }) } },
        ],
      });
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/pages/gA').flush({ ...serverPage, guid: 'gA' });
      await settle();
      fixture.detectChanges();
      expect(screen.queryByText(/loading page/i)).toBeNull();

      paramMap$.next(convertToParamMap({ guid: 'gB' }));
      await settle();
      fixture.detectChanges();

      expect(screen.getByText(/loading page/i)).toBeInTheDocument();
      expect((fixture.nativeElement as HTMLElement).querySelector('wiki-codemirror')).toBeNull();
      http.expectOne('/api/pages/gB').flush({ ...serverPage, guid: 'gB' });
      await settle();
    });

    it('a pending autosave cannot write the discarded draft back during Reload', async () => {
      const { fixture, http } = await load();
      const drafts = TestBed.inject(Drafts);
      // Arms the 400 ms debounced autosave...
      await typeEdit(fixture, '# Discarded draft');
      TestBed.inject(PageContext).remoteChange.set(true);
      fixture.detectChanges();

      // ...and Reload lands inside that window.
      await userEvent.click(screen.getByRole('button', { name: /^reload$/i }));
      await settle();
      const req = http.expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1');
      // Let the debounce elapse while the GET is still in flight.
      await new Promise((r) => setTimeout(r, 500));
      req.flush(serverPage);
      await settle();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 500));

      expect(fixture.componentInstance.content()).toBe(serverPage.content);
      expect(drafts.hasDraft('g1')).toBe(false);
      expect(localStorage.getItem('bluefinwiki:draft:g1')).toBeNull();
    });

    it('a Reload click while a refresh is in flight leaves the banner up', async () => {
      const { fixture, http } = await load();
      const ctx = TestBed.inject(PageContext);
      const comp = fixture.componentInstance as unknown as { refresh: () => Promise<void> };
      const pending = comp.refresh(); // clean: reloads straight away
      await settle();
      ctx.remoteChange.set(true);
      fixture.detectChanges();

      await userEvent.click(screen.getByRole('button', { name: /^reload$/i }));
      // Dropped by the in-flight guard, so the banner must not vanish.
      expect(ctx.remoteChange()).toBe(true);

      http.expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1').flush(serverPage);
      await pending;
    });

    it('keeps the board config and Board view while the page itself reloads', async () => {
      const { http, fixture } = await renderDetail();
      await loadInitiative(http, fixture);
      const comp = fixture.componentInstance as unknown as BoardHost;
      const before = comp.boardConfig();
      expect(before).toEqual(INITIATIVE.boardDefaults);
      expect(comp.viewMode()).toBe('board');

      await bumpPage(fixture);

      // MID-RELOAD of page:g1 (e.g. a card was added elsewhere).
      expect(http.match((r) => r.method === 'GET' && r.url === '/api/pages/g1')).toHaveLength(1);
      expect(comp.boardConfig()).toEqual(before);
      expect(comp.viewMode()).toBe('board');
    });

    it('keeps a direct-children board (probe eligibility) in Board view across a page reload', async () => {
      const { http, fixture } = await renderDetail();
      http.expectOne('/api/pages/g1').flush(serverPage);
      await settle();
      http.expectOne('/api/page-types').flush({ pageTypes: [stateBearingType] });
      http.expectOne('/api/pages/g1/children?include=properties&limit=50').flush({
        children: [stateCard('To Do')],
        hasMore: false,
      });
      await settle();
      fixture.detectChanges();

      const comp = fixture.componentInstance as unknown as { viewMode: () => string };
      await userEvent.click(screen.getByRole('radio', { name: /^board$/i }));
      await settle();
      fixture.detectChanges();
      expect(comp.viewMode()).toBe('board');

      await bumpPage(fixture);
      expect(comp.viewMode()).toBe('board');

      http.expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1').flush(serverPage);
      await settle();
      fixture.detectChanges();
      expect(comp.viewMode()).toBe('board');
      // No second probe was needed: the same parent stays enabled through the reload.
      expect(http.match('/api/pages/g1/children?include=properties&limit=50')).toHaveLength(0);
    });

    describe('Save while the banner is showing', () => {
      async function dirtyWithBanner() {
        const r = await load();
        jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        await typeEdit(r.fixture, '# Mine');
        TestBed.inject(PageContext).remoteChange.set(true);
        r.fixture.detectChanges();
        return r;
      }

      it('asks first, and Cancel sends nothing', async () => {
        const { fixture, http } = await dirtyWithBanner();
        const open = jest
          .spyOn(TestBed.inject(MatDialog), 'open')
          .mockReturnValue({ afterClosed: () => of(false) } as never);

        await fixture.componentInstance.save();

        expect(open).toHaveBeenCalledTimes(1);
        expect((open.mock.calls[0][1] as { data: { title: string } }).data.title).toMatch(/changed elsewhere/i);
        http.expectNone((r) => r.method === 'PUT');
        expect(fixture.componentInstance.content()).toBe('# Mine');
      });

      it('Save anyway saves and clears the banner', async () => {
        const { fixture, http } = await dirtyWithBanner();
        jest
          .spyOn(TestBed.inject(MatDialog), 'open')
          .mockReturnValue({ afterClosed: () => of(true) } as never);

        const done = fixture.componentInstance.save();
        await settle();
        http
          .expectOne((r) => r.method === 'PUT' && r.url === '/api/pages/g1')
          .flush({ ...serverPage, content: '# Mine', modifiedAt: '2026-03-03T00:00:00Z' });
        await done;

        expect(TestBed.inject(PageContext).remoteChange()).toBe(false);
      });

      it('no prompt without the banner', async () => {
        const { fixture } = await load();
        jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        await typeEdit(fixture, '# Mine');
        const open = jest.spyOn(TestBed.inject(MatDialog), 'open');

        void fixture.componentInstance.save();
        await settle();

        expect(open).not.toHaveBeenCalled();
      });
    });

    describe('stashed draft over a newer server page', () => {
      const T1 = serverPage.modifiedAt;
      const T2 = '2026-02-02T00:00:00Z';
      const stash = (baseModifiedAt?: string) =>
        localStorage.setItem('bluefinwiki:draft:g1', JSON.stringify({
          content: '# My draft',
          metadata: { ...serverPage, tags: [] },
          ...(baseModifiedAt ? { baseModifiedAt } : {}),
        }));

      it('raises the banner when the draft was based on an older modifiedAt', async () => {
        stash(T1);
        const { fixture } = await load({ page: { content: '# Theirs', modifiedAt: T2 } });

        expect(fixture.componentInstance.content()).toBe('# My draft');
        expect(TestBed.inject(PageContext).remoteChange()).toBe(true);
        expect(screen.getByText(BANNER)).toBeInTheDocument();
      });

      it('no banner when the draft was based on the current modifiedAt', async () => {
        stash(T2);
        await load({ page: { content: '# Theirs', modifiedAt: T2 } });
        expect(TestBed.inject(PageContext).remoteChange()).toBe(false);
      });

      it('no banner for a legacy draft with no baseModifiedAt', async () => {
        stash();
        await load({ page: { content: '# Theirs', modifiedAt: T2 } });
        expect(TestBed.inject(PageContext).remoteChange()).toBe(false);
      });

      it('an unacknowledged remote change survives a View/Edit toggle', async () => {
        const { fixture, http } = await load();
        await typeEdit(fixture, '# My draft');
        await bumpPage(fixture);
        http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Theirs', modifiedAt: T2 });
        await settle();
        fixture.detectChanges();
        expect(TestBed.inject(PageContext).remoteChange()).toBe(true);

        fixture.destroy(); // the toggle recreates the component; reset() clears the banner
        expect(TestBed.inject(Drafts).get('g1')?.baseModifiedAt).toBe(T1);
      });

      it('Dismiss acknowledges the remote change, so the stashed draft is based on it', async () => {
        const { fixture, http } = await load();
        await typeEdit(fixture, '# My draft');
        await bumpPage(fixture);
        http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Theirs', modifiedAt: T2 });
        await settle();
        fixture.detectChanges();

        await userEvent.click(screen.getByRole('button', { name: /^dismiss$/i }));
        await settle();
        fixture.destroy();
        expect(TestBed.inject(Drafts).get('g1')?.baseModifiedAt).toBe(T2);
      });
    });

    describe('failed background refetch', () => {
      const REFRESH_FAILED = /couldn't refresh this page\./i;
      const DELETED = /this page was deleted elsewhere\. your unsaved changes are kept in this tab/i;
      const editorOf = (fixture: { nativeElement: unknown }) =>
        (fixture.nativeElement as HTMLElement).querySelector('wiki-codemirror');

      it('a same-guid refetch returning 500 keeps the editor mounted and shows an inline error with Retry', async () => {
        const { fixture, http } = await load();
        await typeEdit(fixture, '# My draft');
        const editorEl = editorOf(fixture);
        expect(editorEl).not.toBeNull();

        await bumpPage(fixture);
        http
          .expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1')
          .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
        await settle();
        fixture.detectChanges();

        expect(editorOf(fixture)).toBe(editorEl);
        expect(screen.queryByText(/failed to load page/i)).toBeNull();
        const banner = screen.getByText(REFRESH_FAILED).closest('.banner') as HTMLElement;
        expect(banner).not.toBeNull();
        expect(fixture.componentInstance.content()).toBe('# My draft');

        await userEvent.click(within(banner).getByRole('button', { name: /^retry$/i }));
        await settle();
        http.expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1').flush(serverPage);
        await settle();
        fixture.detectChanges();
        expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
        expect(editorOf(fixture)).toBe(editorEl);
      });

      it('a 404 refetch (deleted elsewhere) shows the deleted message and keeps the working copy', async () => {
        const { fixture, http } = await load();
        await typeEdit(fixture, '# My draft');
        const editorEl = editorOf(fixture);

        await bumpPage(fixture);
        http
          .expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1')
          .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });
        await settle();
        fixture.detectChanges();

        expect(screen.getByText(DELETED)).toBeInTheDocument();
        expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
        expect(screen.queryByText(/failed to load page/i)).toBeNull();
        expect(editorOf(fixture)).toBe(editorEl);
        expect(fixture.componentInstance.content()).toBe('# My draft');
      });

      it('a first load that errors still shows the full error panel', async () => {
        const { fixture, http } = await renderDetail({ editMode: true });
        http
          .expectOne('/api/pages/g1')
          .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
        await settle();
        fixture.detectChanges();

        expect(screen.getByText(/failed to load page/i)).toBeInTheDocument();
        expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
        expect(editorOf(fixture)).toBeNull();
      });

      it('Reload whose GET 404s leaves the draft in storage and the working copy intact', async () => {
        const { fixture, http } = await load();
        const drafts = TestBed.inject(Drafts);
        await typeEdit(fixture, '# My draft');
        // Let the debounced autosave stash the draft.
        await new Promise((r) => setTimeout(r, 500));
        expect(drafts.hasDraft('g1')).toBe(true);
        TestBed.inject(PageContext).remoteChange.set(true);
        fixture.detectChanges();

        await userEvent.click(screen.getByRole('button', { name: /^reload$/i }));
        await settle();
        http
          .expectOne((r) => r.method === 'GET' && r.url === '/api/pages/g1')
          .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });
        await settle();
        fixture.detectChanges();
        await settle();

        expect(drafts.hasDraft('g1')).toBe(true);
        expect(localStorage.getItem('bluefinwiki:draft:g1')).not.toBeNull();
        expect(fixture.componentInstance.content()).toBe('# My draft');
        expect(screen.getByText(DELETED)).toBeInTheDocument();
      });
    });
  });
});

describe('resolveSaveStatus', () => {
  it('prioritises read-only, then saving, then unsaved, then saved', () => {
    expect(resolveSaveStatus({ canEdit: false, saving: true, dirty: true })).toBe('read-only');
    expect(resolveSaveStatus({ canEdit: true, saving: true, dirty: true })).toBe('saving');
    expect(resolveSaveStatus({ canEdit: true, saving: false, dirty: true })).toBe('unsaved');
    expect(resolveSaveStatus({ canEdit: true, saving: false, dirty: false })).toBe('saved');
  });
});
