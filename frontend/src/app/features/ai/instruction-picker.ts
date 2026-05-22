import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { AiInstructions, type AiInstructionSummary } from './ai-instructions';

@Component({
  selector: 'wiki-instruction-picker',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="instruction-picker">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Instructions</mat-label>
        <mat-select
          multiple
          [value]="selected()"
          (selectionChange)="onSelectionChange($any($event.value))"
          aria-label="Attach instructions to chat"
        >
          @if (loading()) {
            <mat-option disabled>Loading...</mat-option>
          } @else if (instructions().length === 0) {
            <mat-option disabled>No instructions yet</mat-option>
          } @else {
            @for (instruction of instructions(); track instruction.guid) {
              <mat-option [value]="instruction.guid">
                {{ instruction.title }}
              </mat-option>
            }
          }
        </mat-select>
      </mat-form-field>
    </div>
  `,
  styles: [`
    .instruction-picker {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .instruction-picker mat-form-field { width: 100%; }
  `],
})
export class InstructionPicker {
  private readonly aiInstructions = inject(AiInstructions);

  private readonly _instructions = signal<readonly AiInstructionSummary[]>([]);
  private readonly _selected = signal<readonly string[]>([]);
  private readonly _loading = signal(true);

  readonly instructions = computed(() => this._instructions());
  readonly selected = computed(() => this._selected());
  readonly loading = computed(() => this._loading());

  constructor() {
    void this.load();
  }

  /** Reload the available instructions list (e.g. after creating one). */
  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const list = await this.aiInstructions.listInstructions();
      this._instructions.set(list);
    } catch (err) {
      console.warn('Failed to load AI instructions:', err);
      this._instructions.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  protected onSelectionChange(value: readonly string[]): void {
    this._selected.set([...value]);
  }

  /** Public for the sidebar: which instruction GUIDs the user has selected. */
  getSelected(): readonly string[] {
    return this._selected();
  }
}
