import { CdkDrag } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PageChildDetail, PageTypeDefinition } from '../pages/page.types';

const MAX_DISPLAY_PROPERTIES = 3;

interface DisplayProperty {
  name: string;
  value: string;
}

/**
 * A single Kanban card. Draggable via CDK (`cdkDrag`). Emits `cardClick`
 * when activated (mouse, Enter, or Space).
 */
@Component({
  selector: 'wiki-board-card',
  standalone: true,
  imports: [CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="board-card"
      cdkDrag
      [cdkDragData]="card()"
      role="button"
      tabindex="0"
      [attr.aria-label]="card().title"
      (click)="onClick()"
      (keydown)="onKeydown($event)"
    >
      <div class="row">
        @if (icon(); as iconText) {
          <span class="icon" [attr.title]="iconTitle()">{{ iconText }}</span>
        }
        <div class="titles">
          <span class="primary" data-testid="board-card-primary">{{ primaryTitle() }}</span>
          @if (secondaryTitle(); as sub) {
            <span class="secondary" data-testid="board-card-secondary">{{ sub }}</span>
          }
        </div>
      </div>
      @if (displayProperties().length > 0) {
        <ul class="props">
          @for (prop of displayProperties(); track prop.name) {
            <li>
              <span class="prop-name">{{ prop.name }}:</span>
              <span class="prop-value">{{ prop.value }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .board-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.5rem 0.625rem;
      cursor: pointer;
      transition: border-color 0.1s, box-shadow 0.1s;
    }
    .board-card:hover { border-color: #93c5fd; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .row { display: flex; gap: 0.4rem; align-items: flex-start; }
    .icon { font-size: 1rem; line-height: 1.25; flex-shrink: 0; }
    .titles { display: flex; flex-direction: column; min-width: 0; }
    .primary { font-weight: 500; font-size: 0.875rem; color: #111827; line-height: 1.25; }
    .secondary { font-size: 0.75rem; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .props { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.125rem; }
    .props li { display: flex; gap: 0.25rem; font-size: 0.75rem; color: #6b7280; }
    .prop-name { color: #9ca3af; }
  `],
})
export class BoardCard {
  readonly card = input.required<PageChildDetail>();
  readonly pageTypesMap = input<Record<string, PageTypeDefinition>>({});
  readonly swapTitles = input<boolean>(false);
  readonly cardClick = output<PageChildDetail>();

  protected readonly icon = computed<string | null>(() => {
    const type = this.card().pageType;
    if (!type) return null;
    return this.pageTypesMap()[type]?.icon ?? null;
  });

  protected readonly iconTitle = computed<string | null>(() => {
    const type = this.card().pageType;
    if (!type) return null;
    return this.pageTypesMap()[type]?.name ?? null;
  });

  protected readonly primaryTitle = computed<string>(() => {
    const c = this.card();
    return this.swapTitles() && c.parentTitle ? c.parentTitle : c.title;
  });

  protected readonly secondaryTitle = computed<string | null>(() => {
    const c = this.card();
    if (this.swapTitles() && c.parentTitle) return c.title;
    return c.parentTitle ?? null;
  });

  protected readonly displayProperties = computed<DisplayProperty[]>(() => {
    const props = this.card().properties;
    if (!props) return [];
    return Object.entries(props)
      .filter(([name]) => name !== 'state')
      .slice(0, MAX_DISPLAY_PROPERTIES)
      .map(([name, prop]) => ({
        name,
        value: Array.isArray(prop.value) ? prop.value.join(', ') : String(prop.value),
      }));
  });

  onClick(): void {
    this.cardClick.emit(this.card());
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.cardClick.emit(this.card());
    }
  }
}
