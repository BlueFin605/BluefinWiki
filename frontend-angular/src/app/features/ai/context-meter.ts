import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'wiki-context-meter',
  standalone: true,
  imports: [MatProgressBarModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (quota() === 0) {
      <div class="meter-empty">Context: ready</div>
    } @else {
      <div
        class="meter"
        [matTooltip]="usage() + ' / ' + quota()"
      >
        <div class="label">
          <span>Context window</span>
          <span>{{ percent() }}%</span>
        </div>
        <mat-progress-bar
          mode="determinate"
          [value]="percent()"
          [color]="color()"
        />
      </div>
    }
  `,
  styles: [`
    .meter { padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; }
    .label {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #4b5563;
      margin-bottom: 0.25rem;
    }
    .meter-empty {
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }
  `],
})
export class ContextMeter {
  readonly usage = input.required<number>();
  readonly quota = input.required<number>();

  protected readonly percent = computed(() => {
    const q = this.quota();
    if (q === 0) return 0;
    return Math.min(100, Math.round((this.usage() / q) * 100));
  });

  protected readonly color = computed<'primary' | 'accent' | 'warn'>(() => {
    const p = this.percent();
    if (p < 60) return 'primary';
    if (p < 85) return 'accent';
    return 'warn';
  });
}
