import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { convertToParamMap, type ParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PageEdit } from './page-edit';
import { Drafts, type PageMetadata } from './drafts';

function route(guid: string) {
  const paramMap: ParamMap = convertToParamMap({ guid });
  return { provide: ActivatedRoute, useValue: { paramMap: of(paramMap) } };
}

const serverPage = {
  guid: 'g1',
  title: 'Page Title',
  content: '# Original',
  folderId: 'f',
  tags: [],
  status: 'published' as const,
  createdBy: 'u',
  modifiedBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
};

function metadataOf(page: typeof serverPage): PageMetadata {
  return {
    title: page.title,
    tags: page.tags,
    status: page.status,
    createdBy: page.createdBy,
    modifiedBy: page.modifiedBy,
    createdAt: page.createdAt,
    modifiedAt: page.modifiedAt,
    guid: page.guid,
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('PageEdit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Try to drain any open requests that came from breadcrumbs / inspector
    // background-loaders mounted by the page-edit shell. We don't assert
    // they fired — those components are covered by their own specs.
    try {
      const http = TestBed.inject(HttpTestingController);
      http.match(() => true).forEach((req) => req.flush(null));
    } catch {
      // TestBed already torn down — nothing to do.
    }
  });

  it('toolbar action invokes applyAction on the editor', async () => {
    const { fixture } = await render(PageEdit, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), route('g1')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await flush();
    fixture.detectChanges();
    await flush();

    // Spy on the editor's applyAction by reading content before/after.
    fixture.componentInstance.content.set('hello');
    fixture.detectChanges();
    const toolbar = screen.getByRole('toolbar', { name: /markdown formatting/i });
    const boldBtn = toolbar.querySelector('button[aria-label="Bold"]') as HTMLButtonElement;
    expect(boldBtn).not.toBeNull();
    boldBtn.click();
    // applyAction wraps the selected text with ** — with no selection the
    // current implementation inserts at the caret (which is 0..0). The
    // resulting doc starts with the wrap+placeholder.
    expect(fixture.componentInstance.content()).toMatch(/^\*\*/);
  });

  it('loads server content into the editor when no draft exists', async () => {
    const { fixture } = await render(PageEdit, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), route('g1')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await flush();
    fixture.detectChanges();
    expect(fixture.componentInstance.content()).toBe('# Original');
  });

  it('prefers the local draft over the server content', async () => {
    // Pre-seed localStorage so the Drafts service picks it up at construction.
    const draft = { content: '# Draft Content', metadata: metadataOf(serverPage) };
    localStorage.setItem('bluefinwiki:draft:g1', JSON.stringify(draft));

    const { fixture } = await render(PageEdit, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), route('g1')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await flush();
    fixture.detectChanges();
    expect(fixture.componentInstance.content()).toBe('# Draft Content');
  });

  it('save() PUTs /api/pages/{guid} with the current content', async () => {
    const { fixture } = await render(PageEdit, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), route('g1')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await flush();

    // Programmatically set content via the model signal exposed by the component.
    fixture.componentInstance.content.set('# Edited');
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    const req = http.expectOne('/api/pages/g1');
    expect(req.request.method).toBe('PUT');
    const body = req.request.body as { content: string };
    expect(body.content).toBe('# Edited');
    req.flush({ ...serverPage, content: '# Edited' });
  });

  it('clears the draft on successful save', async () => {
    const { fixture } = await render(PageEdit, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), route('g1')],
    });
    const drafts = TestBed.inject(Drafts);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await flush();

    fixture.componentInstance.content.set('# Edited');
    drafts.set('g1', { content: '# Edited', metadata: metadataOf(serverPage) });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush({ ...serverPage, content: '# Edited' });
    await flush();

    expect(drafts.hasDraft('g1')).toBe(false);
  });

  it('keeps the draft and shows an error on save failure', async () => {
    const { fixture } = await render(PageEdit, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), route('g1')],
    });
    const drafts = TestBed.inject(Drafts);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1').flush(serverPage);
    await flush();

    fixture.componentInstance.content.set('# Edited');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    http.expectOne('/api/pages/g1').flush(
      { message: 'kaboom' },
      { status: 500, statusText: 'Server Error' },
    );
    await flush();
    fixture.detectChanges();

    expect(drafts.get('g1')?.content).toBe('# Edited');
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
  });
});
