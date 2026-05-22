import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
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

async function renderDialog(data: CardSummaryDialogData) {
  return render(CardSummaryDialog, {
    providers: [
      provideAnimationsAsync(),
      provideRouter([]),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: jest.fn() } },
    ],
  });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('CardSummaryDialog', () => {
  it('renders the card title from MAT_DIALOG_DATA', async () => {
    await renderDialog({
      card: card({ title: 'Hello card' }),
      pageType: null,
    });
    await settle();
    expect(screen.getByText('Hello card')).toBeInTheDocument();
  });

  it('lists custom properties as a definition list', async () => {
    await renderDialog({
      card: card({
        properties: {
          state: { type: 'string', value: 'Done' },
          owner: { type: 'string', value: 'Dean' },
          due: { type: 'date', value: '2026-06-01' },
        },
      }),
      pageType: null,
    });
    await settle();
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
    expect(screen.getByText('Dean')).toBeInTheDocument();
    expect(screen.getByText(/due/i)).toBeInTheDocument();
    expect(screen.getByText('2026-06-01')).toBeInTheDocument();
  });

  it('renders an Open page router link to /pages/:guid', async () => {
    await renderDialog({
      card: card({ guid: 'open-me' }),
      pageType: pageType(),
    });
    await settle();
    const link = screen.getByRole('link', { name: /open page/i });
    expect(link.getAttribute('href')).toBe('/pages/open-me');
  });

  it('renders the page type name when provided', async () => {
    await renderDialog({
      card: card(),
      pageType: pageType({ name: 'Task', icon: '✅' }),
    });
    await settle();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });
});
