import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Pages, type ChildrenWithPropertiesOptions } from '../pages/pages';
import { PageTypes } from '../page-types/page-types';
import { BoardColumn } from './board-column';
import { CardSummaryDialog, type CardSummaryDialogData } from './card-summary-dialog';
import { getColumnColor, groupByState } from './group-by-state';
import type {
  BoardConfig,
  PageChildDetail,
  PageProperty,
  PageTypeDefinition,
} from '../pages/page.types';

/**
 * Kanban Board view. Loads the children of `parentGuid` with their
 * properties, groups them by `state`, and renders one column per state.
 * Dropping a card across columns persists the new state via `updatePage`.
 */
@Component({
  selector: 'wiki-board-view',
  standalone: true,
  imports: [CdkDropListGroup, BoardColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (childrenResource.isLoading()) {
      <div class="state">Loading board...</div>
    } @else if (childrenResource.error()) {
      <div class="state error">Failed to load board.</div>
    } @else {
      <div cdkDropListGroup class="board-cols">
        @for (col of grouping().columns; track col) {
          <wiki-board-column
            [name]="col"
            [color]="columnColor(col)"
            [cards]="grouping().cardsByColumn[col] ?? []"
            [pageTypesMap]="pageTypesMap()"
            [swapTitles]="boardConfig()?.swapTitles ?? false"
            (cardDropped)="onCardDropped($event)"
            (cardClick)="onCardClick($event)"
          />
        } @empty {
          <div class="state">No items to display on the board.</div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .board-cols {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      overflow-x: auto;
      overflow-y: hidden;
      height: 100%;
    }
    .state { padding: 2rem; color: #6b7280; }
    .state.error { color: #b91c1c; }
  `],
})
export class BoardView {
  private readonly pages = inject(Pages);
  private readonly pageTypes = inject(PageTypes);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly parentGuid = input.required<string>();
  readonly boardConfig = input<BoardConfig | null>(null);

  private readonly parentGuidSig = computed<string | null>(() => this.parentGuid() ?? null);
  private readonly options = computed<ChildrenWithPropertiesOptions | null>(() => {
    const cfg = this.boardConfig();
    if (cfg?.targetTypeGuid) {
      return { targetTypeGuid: cfg.targetTypeGuid, depth: cfg.depth ?? 10, limit: 200 };
    }
    return { limit: 200 };
  });

  readonly childrenResource = this.pages.childrenWithPropertiesResource(this.parentGuidSig, this.options);
  readonly pageTypesResource = this.pageTypes.pageTypesResource();

  protected readonly pageTypesMap = computed<Record<string, PageTypeDefinition>>(() => {
    if (this.pageTypesResource.status() !== 'resolved') return {};
    const list = this.pageTypesResource.value() ?? [];
    return Object.fromEntries(list.map((t) => [t.guid, t]));
  });

  protected readonly grouping = computed(() => {
    const children = this.childrenResource.status() === 'resolved'
      ? (this.childrenResource.value()?.children ?? [])
      : [];
    return groupByState(children, this.boardConfig() ?? undefined);
  });

  protected columnColor(name: string): string {
    return getColumnColor(name, this.boardConfig()?.colors);
  }

  async onCardDropped(event: { card: PageChildDetail; targetState: string }): Promise<void> {
    const { card, targetState } = event;
    const currentStateValue = card.properties?.['state']?.value;
    const currentState = typeof currentStateValue === 'string' && currentStateValue
      ? currentStateValue
      : 'Uncategorised';
    if (currentState === targetState) return;
    const merged: Record<string, PageProperty> = {
      ...(card.properties ?? {}),
      state: { type: 'string', value: targetState },
    };
    try {
      await this.pages.updatePage(card.guid, { properties: merged });
    } catch {
      this.snack.open(`Failed to move "${card.title}".`, 'Dismiss', { duration: 4000 });
    }
  }

  onCardClick(card: PageChildDetail): void {
    const pageType = card.pageType ? this.pageTypesMap()[card.pageType] ?? null : null;
    const data: CardSummaryDialogData = { card, pageType };
    this.dialog.open(CardSummaryDialog, { data });
  }
}
