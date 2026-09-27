import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { AiInstructions, type AiInstructionSummary } from './ai-instructions';

@Component({
  selector: 'wiki-instruction-picker',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
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
              <mat-option
                [value]="instruction.guid"
                [disabled]="isLoaded(instruction.guid)"
              >
                {{ instruction.title }}
                @if (isLoaded(instruction.guid)) {
                  <span class="in-context">In context</span>
                }
              </mat-option>
            }
          }
        </mat-select>
      </mat-form-field>

      <div class="create-instruction">
        <input
          type="text"
          [ngModel]="newTitle()"
          (ngModelChange)="newTitle.set($event)"
          name="new-instruction-title"
          placeholder="New instruction title…"
          aria-label="New instruction title"
          [disabled]="creating()"
          (keydown.enter)="onCreateKeydown($event)"
        />
        <button
          mat-stroked-button
          type="button"
          [disabled]="!newTitle().trim() || creating()"
          (click)="onCreate()"
        >
          {{ creating() ? 'Creating…' : 'Create' }}
        </button>
      </div>
      @if (createError()) {
        <p class="create-error">{{ createError() }}</p>
      }
    </div>
  `,
  styles: [`
    .instruction-picker {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .instruction-picker mat-form-field { width: 100%; }
    .in-context {
      margin-left: 0.5rem;
      font-size: 0.625rem;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: #1d4ed8;
    }
    .create-instruction {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.25rem;
    }
    .create-instruction input {
      flex: 1;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.8125rem;
      font-family: inherit;
    }
    .create-error {
      margin: 0.25rem 0 0;
      font-size: 0.75rem;
      color: #dc2626;
    }
  `],
})
export class InstructionPicker {
  private readonly aiInstructions = inject(AiInstructions);
  private readonly router = inject(Router);

  private readonly _instructions = signal<readonly AiInstructionSummary[]>([]);
  private readonly _selected = signal<readonly string[]>([]);
  private readonly _loading = signal(true);
  private readonly _creating = signal(false);
  private readonly _createError = signal<string | null>(null);

  readonly instructions = computed(() => this._instructions());
  readonly selected = computed(() => this._selected());
  readonly loading = computed(() => this._loading());
  readonly creating = computed(() => this._creating());
  readonly createError = computed(() => this._createError());

  /** GUIDs already injected into the current chat session — locked, can't be removed. */
  readonly loadedGuids = input<readonly string[]>([]);

  protected readonly newTitle = signal('');

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

  protected isLoaded(guid: string): boolean {
    return this.loadedGuids().includes(guid);
  }

  protected onSelectionChange(value: readonly string[]): void {
    // Locked (loaded) instructions are rendered `disabled`, so Material
    // never includes a toggle for them in this event — but guard anyway so a
    // loaded instruction can never silently drop out of the selection.
    const locked = this.loadedGuids();
    const merged = locked.filter((g) => !value.includes(g)).concat(value);
    this._selected.set(merged);
  }

  protected onCreateKeydown(event: Event): void {
    event.preventDefault();
    void this.onCreate();
  }

  protected async onCreate(): Promise<void> {
    const title = this.newTitle().trim();
    if (!title || this._creating()) return;
    this._creating.set(true);
    this._createError.set(null);
    try {
      const guid = await this.aiInstructions.createInstruction(title);
      this.newTitle.set('');
      await this.load();
      await this.router.navigate(['/pages', guid, 'edit']);
    } catch (err) {
      this._createError.set(err instanceof Error ? err.message : String(err));
    } finally {
      this._creating.set(false);
    }
  }

  /** Public for the sidebar: which instruction GUIDs the user has selected. */
  getSelected(): readonly string[] {
    return this._selected();
  }
}
