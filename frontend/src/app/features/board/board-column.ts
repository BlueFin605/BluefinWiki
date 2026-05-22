import { CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BoardCard } from './board-card';
import type { PageChildDetail, PageTypeDefinition } from '../pages/page.types';

/**
 * A single Kanban column. Implements `cdkDropList` so other cards can be
 * dropped onto it. Emits `cardDropped` with the dragged card and this
 * column's name; the parent `BoardView` is responsible for persisting the
 * state change.
 */
@Component({
  selector: 'wiki-board-column',
  standalone: true,
  imports: [CdkDropList, BoardCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="board-column">
      <header class="header">
        <span class="dot" [style.background-color]="color()"></span>
        <h3 class="title">{{ name() }}</h3>
        <span class="count" data-testid="board-column-count">{{ cards().length }}</span>
      </header>
      <div
        class="cards"
        cdkDropList
        [cdkDropListData]="name()"
        (cdkDropListDropped)="onDrop($event)"
      >
        @for (card of cards(); track card.guid) {
          <wiki-board-card
            [card]="card"
            [pageTypesMap]="pageTypesMap()"
            [swapTitles]="swapTitles()"
            (cardClick)="cardClick.emit($event)"
          />
        } @empty {
          <div class="empty">No items</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; flex-shrink: 0; }
    .board-column {
      display: flex;
      flex-direction: column;
      background: #f9fafb;
      border-radius: 8px;
      min-width: 280px;
      max-width: 320px;
      height: 100%;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .dot { width: 0.625rem; height: 0.625rem; border-radius: 9999px; flex-shrink: 0; }
    .title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .count {
      font-size: 0.75rem;
      color: #6b7280;
      background: #e5e7eb;
      border-radius: 9999px;
      padding: 0 0.4rem;
    }
    .cards {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-height: 100px;
    }
    .empty { text-align: center; font-size: 0.75rem; color: #9ca3af; padding: 1.5rem 0.5rem; }
    .cdk-drop-list-receiving .cards { background: #eff6ff; }
  `],
})
export class BoardColumn {
  readonly name = input.required<string>();
  readonly color = input.required<string>();
  readonly cards = input.required<PageChildDetail[]>();
  readonly pageTypesMap = input<Record<string, PageTypeDefinition>>({});
  readonly swapTitles = input<boolean>(false);

  readonly cardDropped = output<{ card: PageChildDetail; targetState: string }>();
  readonly cardClick = output<PageChildDetail>();

  onDrop(event: CdkDragDrop<string>): void {
    const dragged = event.item.data as PageChildDetail | undefined;
    if (!dragged) return;
    this.cardDropped.emit({ card: dragged, targetState: this.name() });
  }
}
