import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NewPageModal } from './new-page-modal';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function dialogRefStub<T = unknown>() {
  const calls: T[] = [];
  return {
    ref: {
      close: (v: T): void => { calls.push(v); },
    },
    calls,
  };
}

describe('NewPageModal', () => {
  it('renders a title input', async () => {
    const { ref } = dialogRefStub();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: null } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    // Drain the root-level page-types fetch.
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  // Final review #6: the Parent line must name the real parent, not "Root".
  it('shows "Root" as the parent when creating a top-level page', async () => {
    const { ref } = dialogRefStub();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: null } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    expect(screen.getByText('Root')).toBeInTheDocument();
  });

  it('shows the parent title (not "Root") when creating a child page', async () => {
    const { ref } = dialogRefStub();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { parentGuid: 'parent-1', parentTitle: 'Cookbook', parentPageType: 'pt-parent' },
        },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types/pt-parent/allowed-children')
      .flush({ allowedChildTypes: [], allowWikiPageChildren: true });
    await settle();

    expect(screen.getByText('Cookbook')).toBeInTheDocument();
    expect(screen.queryByText('Root')).toBeNull();
  });

  it('disables submit when title is empty', async () => {
    const { ref } = dialogRefStub();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: null } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('submits POST /api/pages with the right body and closes with the new guid', async () => {
    const stub = dialogRefStub<string | null>();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: 'parent-1', parentPageType: 'pt-parent' } },
        { provide: MatDialogRef, useValue: stub.ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);

    // Drain the initial pageTypes fetch with an empty list so the dropdown is hidden.
    const ptReq = http.expectOne('/api/page-types/pt-parent/allowed-children');
    ptReq.flush({ allowedChildTypes: [], allowWikiPageChildren: true });
    await settle();

    const user = userEvent.setup();
    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, 'My Page');

    await user.click(screen.getByRole('button', { name: /create/i }));

    const req = http.expectOne('/api/pages');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as { title: string; parentGuid: string | null };
    expect(body.title).toBe('My Page');
    expect(body.parentGuid).toBe('parent-1');
    req.flush({
      guid: 'g-new',
      title: 'My Page',
      content: '',
      folderId: 'f',
      tags: [],
      status: 'draft',
      createdBy: 'u',
      modifiedBy: 'u',
      createdAt: '',
      modifiedAt: '',
    });
    await settle();

    expect(stub.calls).toEqual(['g-new']);
  });

  it('auto-selects the sole allowed child type when wiki (untyped) children are disallowed', async () => {
    const { ref } = dialogRefStub<string | null>();
    const rendered = await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: 'parent-1', parentPageType: 'pt-parent' } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types/pt-parent/allowed-children').flush({
      allowedChildTypes: [
        {
          guid: 'pt-note',
          name: 'Note',
          icon: 'note',
          properties: [],
          allowedChildTypes: [],
          allowWikiPageChildren: true,
          allowedParentTypes: [],
          allowAnyParent: true,
          createdBy: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
      allowWikiPageChildren: false,
    });
    await settle();
    rendered.fixture.detectChanges();

    const select = screen.getByRole('combobox');
    expect(select).toHaveTextContent('Note');
  });

  it('does not re-fight a deliberate change back to "(none)" after auto-selecting', async () => {
    const rendered = await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: 'parent-1', parentPageType: 'pt-parent' } },
        { provide: MatDialogRef, useValue: dialogRefStub().ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types/pt-parent/allowed-children').flush({
      allowedChildTypes: [
        {
          guid: 'pt-note', name: 'Note', icon: 'note', properties: [],
          allowedChildTypes: [], allowWikiPageChildren: true, allowedParentTypes: [],
          allowAnyParent: true, createdBy: '', createdAt: '', updatedAt: '',
        },
      ],
      allowWikiPageChildren: false,
    });
    await settle();
    rendered.fixture.detectChanges();

    const cmp = rendered.fixture.componentInstance as unknown as {
      pageType: { set: (v: string | null) => void; (): string | null };
    };
    expect(cmp.pageType()).toBe('pt-note'); // auto-selected

    cmp.pageType.set(null); // user deliberately picks "(none)"
    await settle();
    rendered.fixture.detectChanges();

    expect(cmp.pageType()).toBeNull();
  });

  it('does NOT auto-select when more than one child type is allowed', async () => {
    const { ref } = dialogRefStub<string | null>();
    const rendered = await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: 'parent-1', parentPageType: 'pt-parent' } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types/pt-parent/allowed-children').flush({
      allowedChildTypes: [
        {
          guid: 'pt-note', name: 'Note', icon: 'note', properties: [],
          allowedChildTypes: [], allowWikiPageChildren: true, allowedParentTypes: [],
          allowAnyParent: true, createdBy: '', createdAt: '', updatedAt: '',
        },
        {
          guid: 'pt-task', name: 'Task', icon: 'task', properties: [],
          allowedChildTypes: [], allowWikiPageChildren: true, allowedParentTypes: [],
          allowAnyParent: true, createdBy: '', createdAt: '', updatedAt: '',
        },
      ],
      allowWikiPageChildren: false,
    });
    await settle();
    rendered.fixture.detectChanges();

    const cmp = rendered.fixture.componentInstance as unknown as { pageType: () => string | null };
    expect(cmp.pageType()).toBeNull();
  });

  it('shows "Title is required" after blurring an empty title', async () => {
    const { ref } = dialogRefStub();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: null } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    const user = userEvent.setup();
    const titleInput = screen.getByLabelText(/title/i);
    await user.click(titleInput);
    await user.tab();

    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
  });

  it('shows "3–100 characters" after blurring a too-short title', async () => {
    const { ref } = dialogRefStub();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: null } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    const user = userEvent.setup();
    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, 'ab');
    await user.tab();

    expect(screen.getByText(/3–100 characters/i)).toBeInTheDocument();
  });

  it('does not show a title error before the field has been touched', async () => {
    const { ref } = dialogRefStub();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: null } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types').flush({ pageTypes: [] });

    expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/3–100 characters/i)).not.toBeInTheDocument();
  });

  it('submits content boilerplate and inherited properties built from the selected type + parent properties', async () => {
    const stub = dialogRefStub<string | null>();
    await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            parentGuid: 'parent-1',
            parentPageType: 'pt-parent',
            parentProperties: { status: { type: 'string', value: 'in-progress' } },
          },
        },
        { provide: MatDialogRef, useValue: stub.ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const ptReq = http.expectOne('/api/page-types/pt-parent/allowed-children');
    ptReq.flush({
      allowedChildTypes: [
        {
          guid: 'pt-note',
          name: 'Note',
          icon: 'note',
          properties: [{ name: 'status', type: 'string', required: false, defaultValue: 'backlog' }],
          allowedChildTypes: [],
          allowWikiPageChildren: true,
          allowedParentTypes: [],
          allowAnyParent: true,
          createdBy: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
      allowWikiPageChildren: false, // sole type + wiki disallowed -> auto-selected
    });
    await settle();

    const user = userEvent.setup();
    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, 'My Page');
    await user.click(screen.getByRole('button', { name: /create/i }));

    const req = http.expectOne('/api/pages');
    const body = req.request.body as {
      content?: string;
      properties?: Record<string, { type: string; value: unknown }>;
    };
    expect(body.content).toMatch(/^# My Page\n/);
    expect(body.properties).toEqual({ status: { type: 'string', value: 'in-progress' } });
    req.flush({
      guid: 'g-new', title: 'My Page', content: '', folderId: 'f', tags: [], status: 'draft',
      createdBy: 'u', modifiedBy: 'u', createdAt: '', modifiedAt: '',
    });
    await settle();
    expect(stub.calls).toEqual(['g-new']);
  });

  it('shows the allowed-child-types in the dropdown when present', async () => {
    const { ref } = dialogRefStub();
    const rendered = await render(NewPageModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { parentGuid: 'parent-1', parentPageType: 'pt-parent' } },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types/pt-parent/allowed-children').flush({
      allowedChildTypes: [
        {
          guid: 'pt-note',
          name: 'Note',
          icon: 'note',
          properties: [],
          allowedChildTypes: [],
          allowWikiPageChildren: true,
          allowedParentTypes: [],
          allowAnyParent: true,
          createdBy: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
      allowWikiPageChildren: true,
    });
    await settle();
    rendered.fixture.detectChanges();
    // Click the mat-select to open it; options are rendered into a CDK
    // overlay attached to document.body.
    const user = userEvent.setup();
    const select = screen.getByRole('combobox');
    await user.click(select);
    await settle();
    rendered.fixture.detectChanges();
    expect(screen.getByRole('option', { name: 'Note' })).toBeInTheDocument();
  });
});
