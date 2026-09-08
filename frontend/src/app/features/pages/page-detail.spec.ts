import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { convertToParamMap, type ParamMap } from '@angular/router';
import { of } from 'rxjs';

jest.mock('mermaid', () => ({
  default: {
    initialize: jest.fn(),
    parse: jest.fn(),
    render: jest.fn().mockResolvedValue({ svg: '<svg/>' }),
  },
}));

import { PageDetail } from './page-detail';
import { Drafts } from './drafts';
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
});
