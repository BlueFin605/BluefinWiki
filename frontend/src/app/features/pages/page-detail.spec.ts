import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { convertToParamMap, type ParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
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
import { AttachmentUploader } from '../attachments/attachment-uploader';
import { buildAttachmentMarkdown } from '../attachments/attachment.types';
import { Drafts } from './drafts';
import { Layout } from '../../core/layout/layout';
import { provideBreakpointStub } from '../../testing/breakpoint-stub';
import { ResizeDivider } from '../../shared/components/resize-divider';
import { EditorErrorState } from '../../core/error/editor-error-state';
import { InvalidationBus, pageTag } from '../../core/api/invalidation';
import type { PageProperty } from './page.types';

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
  opts: { guid?: string; editMode?: boolean; noopAnimations?: boolean; isDesktop?: boolean } = {},
) {
  const guid = opts.guid ?? 'g1';
  // PageContext.toggleInspector() and the editor-bar control both branch on
  // Breakpoint; default to desktop so the toggle drives Layout.inspectorVisible
  // (step 4.1 path) and the bar renders the "Toggle inspector" button.
  const bpStub = provideBreakpointStub(opts.isDesktop ?? true);
  const result = await render(PageDetail, {
    providers: [
      opts.noopAnimations ? provideNoopAnimations() : provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      routeStub(guid, opts.editMode),
      ...bpStub.providers,
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

  it('shows the board toggle in view mode when the page has a boardConfig', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      boardConfig: { columns: ['Alpha'], defaultView: 'content' },
    });
    await settle();
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('radio', { name: /^board$/i })).toBeInTheDocument();
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

    // The draft is gone from both the in-memory Map and localStorage.
    expect(drafts.hasDraft('g1')).toBe(false);
    expect(localStorage.getItem('bluefinwiki:draft:g1')).toBeNull();

    // The page resource refetched.
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.detectChanges();
    await settle();

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
    expect(banner).toHaveTextContent(/500 server error/i);
    expect(banner).toHaveTextContent(REASSURANCE);
    // The old non-dismissible generic span is gone.
    expect(screen.queryByText('Save failed: Save failed. Try again.')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /dismiss save error/i }));
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
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

    const ed = (fixture.componentInstance as { editor: () => { replaceRange: (...a: unknown[]) => void } }).editor();
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

  it('persists the inspector open state across a remount via the Layout store', async () => {
    const first = await renderDetail();
    first.http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    await settle();
    expect(TestBed.inject(Layout).inspectorVisible()).toBe(true);

    // The Layout service is providedIn:'root' and hydrates from localStorage on
    // construction, so a fresh mount reads back the persisted flag.
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
});

describe('resolveSaveStatus', () => {
  it('prioritises read-only, then saving, then unsaved, then saved', () => {
    expect(resolveSaveStatus({ canEdit: false, saving: true, dirty: true })).toBe('read-only');
    expect(resolveSaveStatus({ canEdit: true, saving: true, dirty: true })).toBe('saving');
    expect(resolveSaveStatus({ canEdit: true, saving: false, dirty: true })).toBe('unsaved');
    expect(resolveSaveStatus({ canEdit: true, saving: false, dirty: false })).toBe('saved');
  });
});
