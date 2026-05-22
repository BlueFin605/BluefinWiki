import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'wiki-ai-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      [disabled]="disabled()"
      [matTooltip]="disabled() ? 'AI unavailable' : 'AI assistant'"
      aria-label="Open AI assistant"
      (click)="toggled.emit()"
    >
      <mat-icon>psychology</mat-icon>
    </button>
  `,
})
export class AiButton {
  readonly disabled = input<boolean>(false);
  readonly toggled = output<void>();
}
