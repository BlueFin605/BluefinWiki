import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule, type MatChipInputEvent } from '@angular/material/chips';
import {
  MatAutocompleteModule,
  type MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { COMMA, ENTER } from '@angular/cdk/keycodes';

/** Max vocabulary suggestions shown while typing (React parity: "top 5"). */
const MAX_SUGGESTIONS = 5;

/**
 * Chip-grid tag editor with vocabulary autocomplete (step 4.5).
 *
 * Behaviours:
 * - `Enter` / `,` (or picking a suggestion) adds a tag, **lower-cased** and
 *   trimmed; dedupe is **case-insensitive**.
 * - `Backspace` on an **empty** input removes the last chip (no-op when the
 *   input still holds text).
 * - While the user types, up to {@link MAX_SUGGESTIONS} suggestions are drawn
 *   from {@link vocab}, excluding already-applied tags.
 *
 * Pure and presentational: applied tags in ({@link tags}), the vocabulary in
 * ({@link vocab}), the new set out ({@link tagsChange}). Step 4.7 reuses it for
 * ad-hoc custom properties by passing a property-scoped vocabulary.
 */
@Component({
  selector: 'wiki-tag-input',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="fill" class="full">
      <mat-label>Tags</mat-label>
      <mat-chip-grid #chipGrid [disabled]="readOnly()" aria-label="Tags">
        @for (tag of tags(); track tag) {
          <mat-chip-row (removed)="removeTag(tag)">
            {{ tag }}
            @if (!readOnly()) {
              <button matChipRemove type="button" [attr.aria-label]="'Remove ' + tag">
                <mat-icon>cancel</mat-icon>
              </button>
            }
          </mat-chip-row>
        }
        <input
          #tagInput
          placeholder="Add tag"
          [matChipInputFor]="chipGrid"
          [matAutocomplete]="auto"
          [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
          (matChipInputTokenEnd)="addFromInput($event)"
          (input)="query.set(tagInput.value)"
          (keydown)="onKeydown($event)"
          [disabled]="readOnly()"
        />
      </mat-chip-grid>
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="addFromOption($event)">
        @for (s of suggestions(); track s) {
          <mat-option [value]="s">{{ s }}</mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
  styles: [`
    :host { display: block; }
    .full { width: 100%; }
  `],
})
export class TagInput {
  /** Tags currently applied to the page. Assumed already lower-cased. */
  readonly tags = input.required<readonly string[]>();
  /** Full tag vocabulary to suggest from. */
  readonly vocab = input<readonly string[]>([]);
  readonly readOnly = input<boolean>(false);
  /** Emitted with the next full tag set on every add or remove. */
  readonly tagsChange = output<readonly string[]>();

  protected readonly separatorKeyCodes = [ENTER, COMMA] as const;

  /** Live text in the chip input; drives {@link suggestions}. */
  protected readonly query = signal('');

  private readonly tagInputEl = viewChild<ElementRef<HTMLInputElement>>('tagInput');

  /**
   * Up to {@link MAX_SUGGESTIONS} vocabulary entries matching the typed text
   * (case-insensitive substring), excluding tags already applied. Empty until
   * the user types — the panel is an "as you type" affordance, not a dropdown.
   */
  protected readonly suggestions = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (q === '') return [];
    const applied = new Set(this.tags().map((t) => t.toLowerCase()));
    return this.vocab()
      .filter((v) => !applied.has(v.toLowerCase()) && v.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  });

  protected addFromInput(event: MatChipInputEvent): void {
    this.commit(event.value);
    event.chipInput?.clear();
    this.query.set('');
  }

  protected addFromOption(event: MatAutocompleteSelectedEvent): void {
    this.commit(String(event.option.value));
    const el = this.tagInputEl()?.nativeElement;
    if (el) el.value = '';
    this.query.set('');
  }

  protected removeTag(tag: string): void {
    this.tagsChange.emit(this.tags().filter((t) => t !== tag));
  }

  /** `Backspace` on an empty input removes the last chip. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Backspace') return;
    if ((event.target as HTMLInputElement).value !== '') return;
    const current = this.tags();
    if (current.length === 0) return;
    event.preventDefault();
    this.tagsChange.emit(current.slice(0, -1));
  }

  /** Lower-case + trim, then add unless a case-insensitive match already exists. */
  private commit(raw: string): void {
    const value = (raw ?? '').trim().toLowerCase();
    if (!value) return;
    if (this.tags().some((t) => t.toLowerCase() === value)) return;
    this.tagsChange.emit([...this.tags(), value]);
  }
}
