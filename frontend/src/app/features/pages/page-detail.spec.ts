import { effect } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
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
import { AttachmentUploader } from '../attachments/attachment-uploader';
import { buildAttachmentMarkdown } from '../attachments/attachment.types';
import { Drafts } from './drafts';
import { Layout } from '../../core/layout/layout';
import { ResizeDivider } from '../../shared/components/resize-divider';
import { EditorErrorState } from '../../core/error/editor-error-state';

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

async function renderDetail(opts: { guid?: string; editMode?: boolean } = {}) {
  const guid = opts.guid ?? 'g1';
  const result = await render(PageDetail, {
    providers: [
      provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      routeStub(guid, opts.editMode),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  return { ...result, http, guid };
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

  it('mounts the Properties / Attachments / Linked inspector in view mode', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    // Open the inspector sidenav.
    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('tab', { name: /properties/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /attachments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /linked/i })).toBeInTheDocument();
  });

  it('keeps inspector properties editable in view mode', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    drain();
    await settle();
    fixture.detectChanges();
    expect(screen.getByLabelText('Title')).not.toBeDisabled();
    // Clean working copy => no Save button until something changes.
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
  });

  it('surfaces a Save button after a property edit in view mode', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    fixture.componentInstance.metadata.update((m) => (m ? { ...m, title: 'Renamed' } : m));
    fixture.detectChanges();
    await settle();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
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

  it('binds the inspector width to the layout store, not a hardcoded 360px', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    drain();
    await settle();
    fixture.detectChanges();

    const layout = TestBed.inject(Layout);
    const host = fixture.nativeElement as HTMLElement;
    const inspector = host.querySelector('.inspector') as HTMLElement;
    expect(inspector.style.width).toBe(`${layout.inspectorWidth()}px`);
    expect(inspector.style.width).not.toBe('360px');
  });

  it('resizes the inspector via the divider, clamped through the layout store', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    drain();
    await settle();
    fixture.detectChanges();

    const layout = TestBed.inject(Layout);
    const updateSpy = jest.spyOn(layout, 'update');

    const divider = fixture.debugElement.query(By.directive(ResizeDivider))
      .componentInstance as ResizeDivider;
    // Inspector is right-anchored: width = containerRect.right - pointerX. jsdom
    // rects are all-zero, so any positive pointer X drives width below the 250
    // floor.
    divider.resized.emit(80);
    await settle();

    // jsdom rects are all-zero, so the raw right-anchored width is negative;
    // the store clamps it up to the 250 floor.
    expect(updateSpy).toHaveBeenCalledWith({ inspectorWidth: -80 });
    expect(layout.inspectorWidth()).toBe(250);
  });

  it('maps the inspector divider pointer X to a right-anchored width', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush(serverPage);
    await settle();
    await userEvent.click(screen.getByRole('button', { name: /toggle inspector/i }));
    drain();
    await settle();
    fixture.detectChanges();

    const layout = TestBed.inject(Layout);
    const host = fixture.nativeElement as HTMLElement;
    const container = host.querySelector('.container') as HTMLElement;
    jest
      .spyOn(container, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, right: 1000, top: 0, bottom: 0, width: 1000, height: 0, x: 0, y: 0, toJSON: () => ({}) });

    const divider = fixture.debugElement.query(By.directive(ResizeDivider))
      .componentInstance as ResizeDivider;
    divider.resized.emit(600); // 1000 - 600 = 400, within 250-600
    await settle();

    expect(layout.inspectorWidth()).toBe(400);
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
      attachmentGuid: 'a1',
      filename: 'Diagram.png',
      contentType: 'image/png',
      size: 10,
      url: 'cdn/Diagram.png',
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

    (fixture.componentInstance as unknown as { onInsertMarkdown: (m: string) => void })
      .onInsertMarkdown('![x](x.png)');
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await settle();

    // Action succeeded rather than being silently swallowed.
    expect(editorMode(fixture)).toBe('split');
    expect(fixture.componentInstance.content()).toContain('![x](x.png)');
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

  it('applies all landing wiki-link resolutions in a single wikiResolutions update (I4)', async () => {
    const { http, fixture } = await renderDetail();
    http.expectOne('/api/pages/g1').flush({
      ...serverPage,
      content: 'See [[Alpha]], [[Bravo]] and [[Charlie]].',
    });
    await settle();

    const comp = fixture.componentInstance as unknown as {
      wikiResolutions: () => ReadonlyMap<string, unknown>;
    };

    const sizes: number[] = [];
    TestBed.runInInjectionContext(() => {
      effect(() => { sizes.push(comp.wikiResolutions().size); });
    });
    await settle();
    sizes.length = 0; // drop the initial effect run

    // One POST per distinct target, all issued before any response.
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

    // 0 -> 3 in a single update: no intermediate size 1 or 2 was observed.
    expect(comp.wikiResolutions().size).toBe(3);
    expect(sizes).toEqual([3]);
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
});

describe('resolveSaveStatus', () => {
  it('prioritises read-only, then saving, then unsaved, then saved', () => {
    expect(resolveSaveStatus({ canEdit: false, saving: true, dirty: true })).toBe('read-only');
    expect(resolveSaveStatus({ canEdit: true, saving: true, dirty: true })).toBe('saving');
    expect(resolveSaveStatus({ canEdit: true, saving: false, dirty: true })).toBe('unsaved');
    expect(resolveSaveStatus({ canEdit: true, saving: false, dirty: false })).toBe('saved');
  });
});
