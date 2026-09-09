import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { ToolbarAction } from '../../shared/codemirror/wiki-codemirror';

export type { ToolbarAction };

interface ToolbarButton {
  readonly action: ToolbarAction;
  readonly icon: string;
  readonly label: string;
}

const FORMAT_BUTTONS: readonly ToolbarButton[] = [
  { action: 'bold', icon: 'format_bold', label: 'Bold' },
  { action: 'italic', icon: 'format_italic', label: 'Italic' },
  { action: 'strikethrough', icon: 'strikethrough_s', label: 'Strikethrough' },
] as const;

const LIST_BUTTONS: readonly ToolbarButton[] = [
  { action: 'ul', icon: 'format_list_bulleted', label: 'Bulleted list' },
  { action: 'ol', icon: 'format_list_numbered', label: 'Numbered list' },
  { action: 'task', icon: 'check_box', label: 'Task list' },
] as const;

const MEDIA_BUTTONS: readonly ToolbarButton[] = [
  { action: 'link', icon: 'link', label: 'Link' },
  { action: 'image', icon: 'image', label: 'Image' },
  { action: 'attachment', icon: 'attach_file', label: 'Attachment' },
] as const;

const CODE_BUTTONS: readonly ToolbarButton[] = [
  { action: 'code', icon: 'code', label: 'Inline code' },
  { action: 'codeblock', icon: 'data_object', label: 'Code block' },
] as const;

/**
 * Buttons dropped from the compact / mobile variant (React parity): ordered
 * list, task list and code block. Bold / italic / strikethrough, the heading
 * menu, bulleted list, link / image / attachment and inline code all stay.
 */
const COMPACT_HIDDEN: ReadonlySet<ToolbarAction> = new Set<ToolbarAction>(['ol', 'task', 'codeblock']);

@Component({
  selector: 'wiki-markdown-toolbar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Compact = mobile (step 1b.6): the host is pinned to the bottom of the
  // viewport. The responsive layer drives `compact` from `Breakpoint`.
  host: {
    '[class.bottom-pinned]': 'compact()',
  },
  template: `
    <div class="toolbar" role="toolbar" aria-label="Markdown formatting">
      @for (b of formatButtons; track b.action) {
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="b.label"
          [matTooltip]="b.label"
          [disabled]="disabled()"
          (click)="emit(b.action)"
        >
          <mat-icon>{{ b.icon }}</mat-icon>
        </button>
      }

      <button
        mat-icon-button
        type="button"
        aria-label="Heading"
        matTooltip="Heading"
        [disabled]="disabled()"
        [matMenuTriggerFor]="headingMenu"
      >
        <mat-icon>title</mat-icon>
      </button>
      <mat-menu #headingMenu="matMenu" [yPosition]="headingMenuYPosition()">
        @for (h of headings; track h.action) {
          <button mat-menu-item type="button" (click)="emit(h.action)">
            {{ h.label }}
          </button>
        }
      </mat-menu>

      @for (b of listButtons(); track b.action) {
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="b.label"
          [matTooltip]="b.label"
          [disabled]="disabled()"
          (click)="emit(b.action)"
        >
          <mat-icon>{{ b.icon }}</mat-icon>
        </button>
      }

      @for (b of mediaButtons(); track b.action) {
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="b.label"
          [matTooltip]="b.label"
          [disabled]="disabled()"
          (click)="emit(b.action)"
        >
          <mat-icon>{{ b.icon }}</mat-icon>
        </button>
      }

      @for (b of codeButtons(); track b.action) {
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="b.label"
          [matTooltip]="b.label"
          [disabled]="disabled()"
          (click)="emit(b.action)"
        >
          <mat-icon>{{ b.icon }}</mat-icon>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }

    /*
     * Compact / mobile (step 1b.6). page-detail's editor pane does NOT scroll
     * as a unit -- only its inner .body has overflow:auto and the toolbar sits
     * outside it -- so position:sticky has no scrolling ancestor to stick to
     * here; position:fixed is what actually pins it to the bottom of the screen
     * (React parity). The row scrolls horizontally instead of wrapping, and
     * env(safe-area-inset-bottom) clears the home indicator. page-detail adds
     * matching bottom padding to .body so content isn't hidden behind the bar.
     */
    :host.bottom-pinned {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      /* Deliberately below Material's mat-drawer / backdrop stacking: the 1b.5
         inspector bottom-sheet is also mobile bottom:0 / mode="over", so its
         panel + backdrop paint over this toolbar rather than fighting it. */
      z-index: 10;
      background: #f9fafb;
      box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.12);
      padding-bottom: env(safe-area-inset-bottom);
    }
    :host.bottom-pinned .toolbar {
      flex-wrap: nowrap;
      overflow-x: auto;
      border-bottom: none;
      border-top: 1px solid #e5e7eb;
    }
  `],
})
export class MarkdownToolbar {
  readonly disabled = input<boolean>(false);
  /**
   * Compact / mobile variant: hides the ordered-list, task-list and code-block
   * buttons and flips the heading menu so it opens upward. The responsive layer
   * (Phase 1b, step 1b.6) decides *when* to pass this and pins the toolbar to
   * the bottom of the screen.
   */
  readonly compact = input<boolean>(false);
  readonly action = output<ToolbarAction>();

  protected readonly formatButtons = FORMAT_BUTTONS;
  protected readonly listButtons = computed(() => this.visible(LIST_BUTTONS));
  protected readonly mediaButtons = computed(() => this.visible(MEDIA_BUTTONS));
  protected readonly codeButtons = computed(() => this.visible(CODE_BUTTONS));

  /** Compact pins the toolbar to the bottom, so the heading dropdown opens up. */
  protected readonly headingMenuYPosition = computed<'above' | 'below'>(() =>
    this.compact() ? 'above' : 'below',
  );

  protected readonly headings: readonly { action: ToolbarAction; label: string }[] = [
    { action: 'h1', label: 'Heading 1' },
    { action: 'h2', label: 'Heading 2' },
    { action: 'h3', label: 'Heading 3' },
    { action: 'h4', label: 'Heading 4' },
    { action: 'h5', label: 'Heading 5' },
    { action: 'h6', label: 'Heading 6' },
  ];

  emit(action: ToolbarAction): void {
    this.action.emit(action);
  }

  private visible(buttons: readonly ToolbarButton[]): readonly ToolbarButton[] {
    return this.compact() ? buttons.filter((b) => !COMPACT_HIDDEN.has(b.action)) : buttons;
  }
}
