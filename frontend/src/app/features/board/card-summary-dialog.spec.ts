import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CardSummaryDialog, type CardSummaryDialogData } from './card-summary-dialog';
import type { PageChildDetail, PageTypeDefinition } from '../pages/page.types';

function card(over: Partial<PageChildDetail> = {}): PageChildDetail {
  return {
    guid: 'c1',
    title: 'My Card',
    parentGuid: 'p1',
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

function pageType(over: Partial<PageTypeDefinition> = {}): PageTypeDefinition {
  return {
    guid: 'pt-1',
    name: 'Task',
    icon: '✅',
    properties: [],
    allowedChildTypes: [],
    allowWikiPageChildren: false,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: 'u',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

function dialogRefStub() {
  return { close: jest.fn() };
}

async function renderDialog(data: CardSummaryDialogData, ref = dialogRefStub()) {
  const result = await render(CardSummaryDialog, {
    providers: [
      provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref },
    ],
  });
  return { ...result, ref };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('CardSummaryDialog', () => {
  it('renders the card title in the heading', async () => {
    await renderDialog({ card: card({ title: 'Hello card' }), pageType: null });
    await settle();
    expect(screen.getByText('Hello card')).toBeInTheDocument();
  });

  it('renders an editable Title field seeded with the card title', async () => {
    await renderDialog({ card: card({ title: 'Hello card' }), pageType: null });
    await settle();
    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput.value).toBe('Hello card');
  });

  it('renders the page type name and parent title when present', async () => {
    await renderDialog({
      card: card({ parentTitle: 'Backlog' }),
      pageType: pageType({ name: 'Task' }),
    });
    await settle();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
  });

  it('disables Save when nothing has changed', async () => {
    await renderDialog({ card: card(), pageType: null });
    await settle();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('enables Save when the title is edited', async () => {
    await renderDialog({ card: card(), pageType: null });
    await settle();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/title/i), '!');
    await settle();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('enables Save when a number property is edited', async () => {
    await renderDialog({
      card: card({ properties: { count: { type: 'number', value: 1 } } }),
      pageType: pageType({ properties: [{ name: 'count', type: 'number', required: false }] }),
    });
    await settle();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/count/i), '2');
    await settle();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('Save issues PUT /pages/<cardGuid> with the merged properties + title, then closes', async () => {
    const { ref } = await renderDialog({
      card: card({
        guid: 'card-42',
        title: 'My Card',
        properties: { status: { type: 'string', value: 'todo' } },
      }),
      pageType: pageType({
        properties: [
          { name: 'status', type: 'string', required: false },
          { name: 'owner', type: 'string', required: false, defaultValue: 'unassigned' },
        ],
      }),
    });
    await settle();
    const http = TestBed.inject(HttpTestingController);

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), 'Renamed Card');
    await settle();

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    const req = http.expectOne('/api/pages/card-42');
    expect(req.request.method).toBe('PUT');
    const body = req.request.body as {
      title: string;
      properties: Record<string, { type: string; value: unknown }>;
    };
    expect(body.title).toBe('Renamed Card');
    // Schema fields merged: existing `status` kept, missing `owner` seeded with its default.
    expect(body.properties).toEqual({
      status: { type: 'string', value: 'todo' },
      owner: { type: 'string', value: 'unassigned' },
    });
    req.flush({
      guid: 'card-42',
      title: 'Renamed Card',
      content: '',
      folderId: 'p1',
      tags: [],
      status: 'published',
      createdBy: 'u',
      modifiedBy: 'u',
      createdAt: '',
      modifiedAt: '',
    });
    await settle();

    expect(ref.close).toHaveBeenCalled();
  });

  it('omits unset number/date properties from the PUT body when only the title is edited', async () => {
    const { ref } = await renderDialog({
      card: card({
        guid: 'card-unset',
        title: 'My Card',
        properties: { status: { type: 'string', value: 'todo' } },
      }),
      // `estimate` and `due` are declared by the type but never filled in on
      // this card, and neither declares a defaultValue — `mergeSchema` seeds
      // both as ''. Sent as `{type:'number', value:''}` the backend rejects
      // the whole save with a 400, so a plain rename would fail.
      pageType: pageType({
        properties: [
          { name: 'status', type: 'string', required: false },
          { name: 'estimate', type: 'number', required: false },
          { name: 'due', type: 'date', required: false },
          { name: 'labels', type: 'tags', required: false },
        ],
      }),
    });
    await settle();
    const http = TestBed.inject(HttpTestingController);

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), 'Renamed Card');
    await settle();
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    const req = http.expectOne('/api/pages/card-unset');
    const body = req.request.body as {
      title: string;
      properties: Record<string, { type: string; value: unknown }>;
    };
    expect(body.title).toBe('Renamed Card');
    // The unset number/date fields are absent entirely — not sent as ''.
    expect(body.properties).toEqual({
      status: { type: 'string', value: 'todo' },
      labels: { type: 'tags', value: [] },
    });
    expect(body.properties['estimate']).toBeUndefined();
    expect(body.properties['due']).toBeUndefined();

    req.flush({
      guid: 'card-unset',
      title: 'Renamed Card',
      content: '',
      folderId: 'p1',
      tags: [],
      status: 'published',
      createdBy: 'u',
      modifiedBy: 'u',
      createdAt: '',
      modifiedAt: '',
    });
    await settle();
    expect(ref.close).toHaveBeenCalled();
  });

  it('still sends a number property that actually has a value', async () => {
    await renderDialog({
      card: card({
        guid: 'card-filled',
        properties: { estimate: { type: 'number', value: 0 } },
      }),
      pageType: pageType({
        properties: [{ name: 'estimate', type: 'number', required: false }],
      }),
    });
    await settle();
    const http = TestBed.inject(HttpTestingController);

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), 'Renamed');
    await settle();
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    const req = http.expectOne('/api/pages/card-filled');
    const body = req.request.body as {
      properties: Record<string, { type: string; value: unknown }>;
    };
    // 0 is a real value, not "unset" — it must survive the filter.
    expect(body.properties['estimate']).toEqual({ type: 'number', value: 0 });
    req.flush({
      guid: 'card-filled', title: 'Renamed', content: '', folderId: 'p1', tags: [],
      status: 'published', createdBy: 'u', modifiedBy: 'u', createdAt: '', modifiedAt: '',
    });
    await settle();
  });

  it('"Open full editor" opens /pages/:guid in a new tab', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    await renderDialog({ card: card({ guid: 'open-me' }), pageType: null });
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /open full editor/i }));
    expect(openSpy).toHaveBeenCalledWith('/pages/open-me', '_blank');
    openSpy.mockRestore();
  });

  it('Esc closes the dialog (Material default)', async () => {
    TestBed.configureTestingModule({
      providers: [provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting()],
    });
    const dialog = TestBed.inject(MatDialog);
    const data: CardSummaryDialogData = { card: card(), pageType: null };
    dialog.open(CardSummaryDialog, { data });
    await settle();
    expect(dialog.openDialogs.length).toBe(1);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }),
    );
    await settle();

    expect(dialog.openDialogs.length).toBe(0);
  });
});
