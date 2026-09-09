import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { PageTags } from '../tags/page-tags';
import { TagInput } from './tag-input';
import { mergeSchema } from '../pages/merge-schema';
import { validatePropertyName } from '../pages/property-name';
import type {
  PageProperty,
  PageTypeDefinition,
  PropertyType,
} from '../pages/page.types';

/**
 * Custom Properties inspector section (step 4.7, React `CustomPropertiesEditor`
 * parity):
 *
 * - **Collapsible** — a header button toggles the body; the collapsed/expanded
 *   state is local (not persisted).
 * - **Schema merged with saved values** — {@link mergeSchema} (step 4.4, union
 *   merge) drives the rendered rows: every page-type field appears (seeded with
 *   its default when unset), followed by any saved property the schema does not
 *   define (an *ad-hoc* property).
 * - **Per-type editors** — text / number / date inputs, and for `tags` the
 *   reusable {@link TagInput} chip control (step 4.5) with a vocabulary scoped
 *   by the property name (matching the backend's
 *   `autoRegisterTagsFromProperties`), **not** a comma-separated text box.
 * - **Add ad-hoc property** — a small form: a kebab-cased, non-empty, unique
 *   name ({@link validatePropertyName}) plus a type. The new key is added to the
 *   emitted `properties`; it is not backed by the schema.
 * - **Remove** — only ad-hoc properties carry a remove button; schema-defined
 *   fields are fixed (React parity).
 *
 * Changes leave through {@link propertiesChange}; the host merges them into the
 * page metadata and persists them via `updatePage` `properties` on Save (the
 * same path the fixed-schema editor already used).
 */
@Component({
  selector: 'wiki-custom-properties-editor',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    TagInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <button
        type="button"
        class="section-toggle"
        [attr.aria-expanded]="!collapsed()"
        (click)="toggle()"
      >
        <mat-icon aria-hidden="true">{{ collapsed() ? 'chevron_right' : 'expand_more' }}</mat-icon>
        <span>Custom Properties</span>
      </button>

      @if (!collapsed()) {
        <div class="body">
          @for (row of rows(); track row.name) {
            <div class="prop-row">
              @if (row.prop.type === 'tags') {
                <div class="tags-field">
                  <span class="prop-name">{{ row.name }}</span>
                  <wiki-tag-input
                    [tags]="tagsOf(row.prop)"
                    [vocab]="vocabFor(row.name)"
                    [readOnly]="!editable()"
                    (tagsChange)="onTagsChange(row.name, $event)"
                  />
                </div>
              } @else {
                <mat-form-field appearance="fill" class="full">
                  <mat-label>{{ row.name }}</mat-label>
                  @if (row.prop.type === 'number') {
                    <input
                      matInput
                      type="number"
                      [disabled]="!editable()"
                      [value]="numberText(row.prop)"
                      (input)="onNumberInput(row.name, $event)"
                    />
                  } @else if (row.prop.type === 'date') {
                    <input
                      matInput
                      type="date"
                      [disabled]="!editable()"
                      [value]="textOf(row.prop)"
                      (input)="onValueInput(row.name, 'date', $event)"
                    />
                  } @else {
                    <input
                      matInput
                      type="text"
                      [disabled]="!editable()"
                      [value]="textOf(row.prop)"
                      (input)="onValueInput(row.name, 'string', $event)"
                    />
                  }
                </mat-form-field>
              }

              @if (row.adHoc && editable()) {
                <button
                  type="button"
                  class="remove-btn"
                  [attr.aria-label]="'Remove ' + row.name"
                  (click)="removeProperty(row.name)"
                >
                  <mat-icon aria-hidden="true">close</mat-icon>
                </button>
              }
            </div>
          }

          @if (editable()) {
            <div class="add-form">
              <mat-form-field appearance="fill" class="grow">
                <mat-label>New property name</mat-label>
                <input
                  matInput
                  type="text"
                  placeholder="New property name"
                  [ngModel]="newName()"
                  (ngModelChange)="newName.set($event)"
                  (keydown.enter)="addProperty()"
                />
              </mat-form-field>

              <mat-form-field appearance="fill">
                <mat-label>New property type</mat-label>
                <mat-select [ngModel]="newType()" (ngModelChange)="newType.set($event)">
                  <mat-option value="string">Text</mat-option>
                  <mat-option value="number">Number</mat-option>
                  <mat-option value="date">Date</mat-option>
                  <mat-option value="tags">Tags</mat-option>
                </mat-select>
              </mat-form-field>

              <button type="button" class="add-btn" (click)="addProperty()">Add property</button>
            </div>

            @if (addError(); as err) {
              <p class="add-error" role="alert">{{ err }}</p>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .panel { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }
    .section-toggle {
      display: flex; align-items: center; gap: 0.25rem;
      width: 100%; padding: 0.25rem 0; border: none; background: none;
      font: inherit; font-weight: 600; color: inherit; text-align: left; cursor: pointer;
    }
    .body { display: flex; flex-direction: column; gap: 0.5rem; }
    .prop-row { display: flex; align-items: flex-start; gap: 0.25rem; }
    .prop-row .full, .prop-row .tags-field { flex: 1 1 auto; min-width: 0; }
    .tags-field { display: flex; flex-direction: column; }
    .prop-name { font-size: 0.75rem; color: #6b7280; }
    .remove-btn {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      margin-top: 0.5rem; padding: 0.25rem;
      border: none; background: none; color: #6b7280; cursor: pointer;
    }
    .remove-btn:hover { color: #b91c1c; }
    .add-form { display: flex; align-items: flex-start; gap: 0.5rem; }
    .add-form .grow { flex: 1 1 auto; min-width: 0; }
    .add-btn {
      margin-top: 0.5rem; padding: 0.375rem 0.75rem;
      border: 1px solid #cbd5e1; border-radius: 4px; background: #ffffff;
      font: inherit; cursor: pointer;
    }
    .add-error { margin: 0; color: #b91c1c; font-size: 0.875rem; }
  `],
})
export class CustomPropertiesEditor {
  private readonly pageTags = inject(PageTags);

  readonly pageType = input.required<PageTypeDefinition>();
  readonly properties = input<Record<string, PageProperty>>({});
  readonly editable = input<boolean>(true);
  readonly propertiesChange = output<Record<string, PageProperty>>();

  /** Local collapsed/expanded state — starts expanded, not persisted. */
  protected readonly collapsed = signal(false);

  protected readonly newName = signal('');
  protected readonly newType = signal<PropertyType>('string');
  protected readonly addError = signal<string | null>(null);

  private readonly schema = computed(() => this.pageType().properties ?? []);
  private readonly schemaKeys = computed(
    () => new Set(this.schema().map((f) => f.name)),
  );

  /**
   * Rendered rows: the schema-merged property set (schema fields first, then
   * ad-hoc), each tagged with whether it is `adHoc` (key absent from the
   * schema) and therefore removable.
   */
  protected readonly rows = computed(() => {
    const keys = this.schemaKeys();
    return Object.entries(mergeSchema(this.properties(), this.schema())).map(
      ([name, prop]) => ({ name, prop, adHoc: !keys.has(name) }),
    );
  });

  private readonly rowNames = computed(() => this.rows().map((r) => r.name));

  /** Property names needing a `tags` vocabulary, one autocomplete list each. */
  private readonly tagScopes = computed(() =>
    this.rows().filter((r) => r.prop.type === 'tags').map((r) => r.name),
  );

  private readonly vocabRes = this.pageTags.multiVocabResource(() =>
    this.tagScopes(),
  );
  private readonly vocabMap = computed<Record<string, string[]>>(() =>
    this.vocabRes.status() === 'resolved' ? this.vocabRes.value() ?? {} : {},
  );

  protected vocabFor(name: string): readonly string[] {
    return this.vocabMap()[name] ?? [];
  }

  protected textOf(prop: PageProperty): string {
    return typeof prop.value === 'string' ? prop.value : '';
  }

  protected numberText(prop: PageProperty): string {
    return typeof prop.value === 'number' ? String(prop.value) : '';
  }

  protected tagsOf(prop: PageProperty): readonly string[] {
    return Array.isArray(prop.value) ? prop.value : [];
  }

  protected toggle(): void {
    this.collapsed.update((c) => !c);
  }

  protected onValueInput(name: string, type: 'string' | 'date', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.patch(name, { type, value });
  }

  protected onNumberInput(name: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.patch(name, { type: 'number', value: raw === '' ? '' : Number(raw) });
  }

  protected onTagsChange(name: string, tags: readonly string[]): void {
    this.patch(name, { type: 'tags', value: [...tags] });
  }

  protected removeProperty(name: string): void {
    const next = { ...this.properties() };
    delete next[name];
    this.propertiesChange.emit(next);
  }

  protected addProperty(): void {
    const check = validatePropertyName(this.newName(), this.rowNames());
    if (!check.ok) {
      this.addError.set(check.error);
      return;
    }
    const type = this.newType();
    const value: PageProperty['value'] = type === 'tags' ? [] : '';
    this.propertiesChange.emit({
      ...this.properties(),
      [check.name]: { type, value },
    });
    this.newName.set('');
    this.newType.set('string');
    this.addError.set(null);
  }

  private patch(name: string, prop: PageProperty): void {
    this.propertiesChange.emit({ ...this.properties(), [name]: prop });
  }
}
