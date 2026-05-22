import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BoardCard } from './board-card';
import type { PageChildDetail, PageTypeDefinition } from '../pages/page.types';

function card(over: Partial<PageChildDetail> = {}): PageChildDetail {
  return {
    guid: 'c1',
    title: 'My Card',
    parentGuid: 'p1',
    parentTitle: 'Parent Page',
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

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('BoardCard', () => {
  it('renders the card title', async () => {
    await render(BoardCard, {
      inputs: { card: card({ title: 'Hello card' }) },
    });
    await settle();
    expect(screen.getByText('Hello card')).toBeInTheDocument();
  });

  it('swaps primary and secondary titles when swapTitles is true', async () => {
    await render(BoardCard, {
      inputs: {
        card: card({ title: 'My Card', parentTitle: 'Parent Page' }),
        swapTitles: true,
      },
    });
    await settle();
    const primary = screen.getByTestId('board-card-primary');
    const secondary = screen.getByTestId('board-card-secondary');
    expect(primary.textContent).toBe('Parent Page');
    expect(secondary.textContent).toBe('My Card');
  });

  it('attaches the cdkDrag directive to the card root', async () => {
    const { container } = await render(BoardCard, {
      inputs: { card: card() },
    });
    await settle();
    const root = container.querySelector('[cdkdrag], .cdk-drag');
    expect(root).not.toBeNull();
  });

  it('emits cardClick when the card is clicked', async () => {
    const events: PageChildDetail[] = [];
    await render(BoardCard, {
      inputs: { card: card({ guid: 'c-click' }) },
      on: { cardClick: (e: PageChildDetail) => events.push(e) },
    });
    await settle();
    const root = screen.getByRole('button', { name: /my card/i });
    await userEvent.click(root);
    expect(events.map((c) => c.guid)).toEqual(['c-click']);
  });

  it('renders the page type icon when pageTypesMap matches the card pageType', async () => {
    await render(BoardCard, {
      inputs: {
        card: card({ pageType: 'pt-1' }),
        pageTypesMap: { 'pt-1': pageType({ icon: '✅' }) },
      },
    });
    await settle();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });
});
