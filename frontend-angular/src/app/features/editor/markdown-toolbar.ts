import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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

const BUTTONS: readonly ToolbarButton[] = [
  { action: 'bold', icon: 'format_bold', label: 'Bold' },
  { action: 'italic', icon: 'format_italic', label: 'Italic' },
  { action: 'strikethrough', icon: 'strikethrough_s', label: 'Strikethrough' },
] as const;

const LIST_BUTTONS: readonly ToolbarButton[] = [
  { action: 'ul', icon: 'format_list_bulleted', label: 'Bulleted list' },
  { action: 'ol', icon: 'format_list_numbered', label: 'Numbered list' },
  { action: 'task', icon: 'check_box', label: 'Task list' },
] as const;

const TRAILING_BUTTONS: readonly ToolbarButton[] = [
  { action: 'link', icon: 'link', label: 'Link' },
  { action: 'code', icon: 'code', label: 'Inline code' },
  { action: 'codeblock', icon: 'data_object', label: 'Code block' },
] as const;

@Component({
  selector: 'wiki-markdown-toolbar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar" role="toolbar" aria-label="Markdown formatting">
      @for (b of buttons; track b.action) {
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
      <mat-menu #headingMenu="matMenu">
        @for (h of headings; track h.action) {
          <button mat-menu-item type="button" (click)="emit(h.action)">
            {{ h.label }}
          </button>
        }
      </mat-menu>

      @for (b of listButtons; track b.action) {
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

      @for (b of trailingButtons; track b.action) {
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
  `],
})
export class MarkdownToolbar {
  readonly disabled = input<boolean>(false);
  readonly action = output<ToolbarAction>();

  protected readonly buttons = BUTTONS;
  protected readonly listButtons = LIST_BUTTONS;
  protected readonly trailingButtons = TRAILING_BUTTONS;
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
}
