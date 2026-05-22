import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { BoardColumn } from './board-column';
import type { PageChildDetail } from '../pages/page.types';

function card(over: Partial<PageChildDetail> = {}): PageChildDetail {
  return {
    guid: 'c1',
    title: 'Card',
    parentGuid: 'p1',
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('BoardColumn', () => {
  it('renders the column name and card count in the header', async () => {
    await render(BoardColumn, {
      inputs: {
        name: 'To Do',
        color: '#6b7280',
        cards: [card({ guid: 'a' }), card({ guid: 'b' })],
      },
    });
    await settle();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByTestId('board-column-count').textContent?.trim()).toBe('2');
  });

  it('renders one wiki-board-card per card', async () => {
    await render(BoardColumn, {
      inputs: {
        name: 'X',
        color: '#000',
        cards: [
          card({ guid: 'a', title: 'Card A' }),
          card({ guid: 'b', title: 'Card B' }),
        ],
      },
    });
    await settle();
    expect(screen.getByRole('button', { name: /card a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /card b/i })).toBeInTheDocument();
  });

  it('shows an empty-state hint when no cards are present', async () => {
    await render(BoardColumn, {
      inputs: { name: 'X', color: '#000', cards: [] },
    });
    await settle();
    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });

  it('emits cardDropped with the dragged card and target column name', async () => {
    const events: { card: PageChildDetail; targetState: string }[] = [];
    const { fixture } = await render(BoardColumn, {
      inputs: {
        name: 'Done',
        color: '#22c55e',
        cards: [card({ guid: 'c-drop' })],
      },
      on: {
        cardDropped: (e: { card: PageChildDetail; targetState: string }) => events.push(e),
      },
    });
    await settle();
    const draggedCard = card({ guid: 'dragged', title: 'Dragged Card' });
    const dropEvent: Partial<CdkDragDrop<string>> = {
      item: { data: draggedCard } as unknown as CdkDragDrop<string>['item'],
      previousContainer: { id: 'src', data: 'X' } as unknown as CdkDragDrop<string>['previousContainer'],
      container: { id: 'dst', data: 'Done' } as unknown as CdkDragDrop<string>['container'],
      previousIndex: 0,
      currentIndex: 0,
      isPointerOverContainer: true,
      distance: { x: 0, y: 0 },
    };
    const instance = fixture.componentInstance;
    instance.onDrop(dropEvent as CdkDragDrop<string>);
    expect(events).toEqual([{ card: draggedCard, targetState: 'Done' }]);
  });

  it('bubbles cardClick from a child board-card', async () => {
    const clicked: PageChildDetail[] = [];
    await render(BoardColumn, {
      inputs: {
        name: 'X',
        color: '#000',
        cards: [card({ guid: 'inner', title: 'Inner Card' })],
      },
      on: { cardClick: (e: PageChildDetail) => clicked.push(e) },
    });
    await settle();
    const innerCard = screen.getByRole('button', { name: /inner card/i });
    await userEvent.click(innerCard);
    expect(clicked.map((c) => c.guid)).toEqual(['inner']);
  });
});
