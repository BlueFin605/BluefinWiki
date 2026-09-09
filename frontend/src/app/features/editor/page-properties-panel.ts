import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule, type MatChipInputEvent } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { PageTypes } from '../page-types/page-types';
import type { PageMetadata } from '../pages/drafts';
import type { PageProperty } from '../pages/page.types';
import { mergeSchema } from '../pages/merge-schema';

/**
 * Payload for {@link PagePropertiesPanel.pageTypeChange}. `properties` carries
 * the schema-merged set when a real type is chosen; it is **omitted** for the
 * "(none)" selection, which clears the type only and leaves the stored
 * properties untouched.
 */
export interface PageTypeChange {
  pageType: string | null;
  properties?: Record<string, PageProperty>;
}

const DEBOUNCE_MS = 200;

@Component({
  selector: 'wiki-page-properties-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <!--
        Click-to-edit Title (step 4.3, React parity): the title shows as text
        with an edit affordance; clicking swaps in the input (focused + text
        selected). Editing it live-updates the metadata (debounced) and, when
        the editor buffer's first non-empty line is an \`# H1\`, rewrites that
        line via \`titleH1Sync\`. A blank/whitespace title on blur is reverted
        to the last non-empty value and never persisted.
      -->
      <div class="title-block">
        @if (editing()) {
          <mat-form-field appearance="fill" class="full">
            <mat-label>Title</mat-label>
            <input
              #titleInput
              matInput
              type="text"
              [disabled]="readOnly()"
              [ngModel]="title()"
              (ngModelChange)="onTitleInput($event)"
              (blur)="onTitleBlur()"
              (keydown.enter)="onTitleEnter()"
              (keydown.escape)="onTitleEnter()"
            />
          </mat-form-field>
        } @else {
          <button
            type="button"
            class="title-display"
            aria-label="Title"
            [disabled]="readOnly()"
            (click)="startEditing()"
          >
            <span class="title-text">{{ title() || 'Untitled' }}</span>
            <mat-icon aria-hidden="true">edit</mat-icon>
          </button>
        }
      </div>

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
            placeholder="Add tag"
            [matChipInputFor]="chipGrid"
            [matChipInputSeparatorKeyCodes]="separatorKeyCodes"
            (matChipInputTokenEnd)="addTag($event)"
            [disabled]="readOnly()"
          />
        </mat-chip-grid>
      </mat-form-field>

      <mat-form-field appearance="fill" class="full">
        <mat-label>Status</mat-label>
        <mat-select
          [disabled]="readOnly()"
          [ngModel]="status()"
          (ngModelChange)="status.set($event)"
        >
          <mat-option value="draft">Draft</mat-option>
          <mat-option value="published">Published</mat-option>
          <mat-option value="archived">Archived</mat-option>
        </mat-select>
      </mat-form-field>

      <!--
        Page Type (step 4.4, React parity): hidden entirely when no page types
        are defined. Changing the type builds the merged property set (new
        schema defaults + retained compatible values, plus any existing
        properties the new schema doesn't define — union merge, no data loss)
        and persists it immediately alongside the type — the host writes both
        in one \`updatePage\`, so schema fields appear and stick without the
        user touching a field. Selecting (none) clears only the type and
        leaves properties untouched.
      -->
      @if (allTypes().length) {
        <mat-form-field appearance="fill" class="full">
          <mat-label>Page type</mat-label>
          <mat-select
            [disabled]="readOnly()"
            [ngModel]="pageType()"
            (ngModelChange)="onPageTypeChange($event)"
          >
            <mat-option [value]="null">(none)</mat-option>
            @for (t of allTypes(); track t.guid) {
              <mat-option [value]="t.guid">{{ t.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      <dl class="meta">
        <dt>Author</dt>
        <dd>{{ metadata().createdBy }}</dd>
        <dt>Last modified by</dt>
        <dd>{{ metadata().modifiedBy }}</dd>
        <dt>Created</dt>
        <dd>{{ metadata().createdAt }}</dd>
        <dt>Modified</dt>
        <dd>{{ metadata().modifiedAt }}</dd>
      </dl>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .panel { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }
    .full { width: 100%; }
    .title-block { display: block; }
    .title-display {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      width: 100%; padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e1; border-radius: 4px; background: #ffffff;
      font: inherit; text-align: left; color: inherit; cursor: pointer;
    }
    .title-display:hover:not(:disabled) { border-color: #94a3b8; }
    .title-display:disabled { cursor: default; color: #9ca3af; background: #f9fafb; }
    .title-display .title-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .title-display mat-icon { flex: none; font-size: 18px; width: 18px; height: 18px; color: #6b7280; }
    .meta { display: grid; grid-template-columns: max-content 1fr; column-gap: 0.5rem; row-gap: 0.25rem; color: #6b7280; font-size: 0.875rem; margin: 0; }
    .meta dt { font-weight: 600; }
    .meta dd { margin: 0; }
  `],
})
export class PagePropertiesPanel {
  private readonly pageTypes = inject(PageTypes);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly metadata = input.required<PageMetadata>();
  readonly readOnly = input<boolean>(false);
  readonly metadataChange = output<PageMetadata>();
  /**
   * Emitted (debounced, alongside {@link metadataChange}) when the user edits
   * the Title field. The host uses it to rewrite a leading `# H1` line in the
   * editor buffer. Deliberately **not** emitted for programmatic metadata
   * hydration (see {@link userTitleDirty}) nor for a blank value — the first
   * half of the feedback-loop guard, the other half being the host's no-op
   * check on `rewriteFirstH1`.
   */
  readonly titleH1Sync = output<string>();
  /**
   * Emitted **synchronously** when the user picks a different Page Type — not
   * debounced like {@link metadataChange}. Carries the new type guid (or `null`
   * for "(none)") and the property set merged against that type's schema
   * ({@link mergeSchema}). The host persists both in one `updatePage` right
   * away, so the schema's fields are seeded and saved without the user editing
   * anything (React parity — the old flow only persisted the merge if a field
   * was subsequently touched).
   */
  readonly pageTypeChange = output<PageTypeChange>();

  protected readonly separatorKeyCodes = [ENTER, COMMA] as const;

  private readonly titleInputEl = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  // Local copies so the chip + select bindings can write back without
  // mutating the input metadata.
  protected readonly title = signal('');
  protected readonly tags = signal<readonly string[]>([]);
  protected readonly status = signal<PageMetadata['status']>('draft');
  protected readonly pageType = signal<string | null>(null);

  /** Click-to-edit: false = show the title as text, true = show the input. */
  protected readonly editing = signal(false);

  /**
   * Last non-empty Title value seen (from hydration or a user keystroke).
   * A blank field on blur is reverted to this — an empty title is never
   * persisted.
   */
  private lastNonEmptyTitle = '';
  /**
   * True once the user has typed in the Title field; reset on every genuine
   * metadata-input hydration. Gates {@link titleH1Sync} so a programmatic
   * metadata change can never drive an H1 rewrite.
   */
  private userTitleDirty = false;

  private readonly pageTypesResource = this.pageTypes.pageTypesResource();
  protected readonly allTypes = computed(() =>
    this.pageTypesResource.status() === 'resolved'
      ? this.pageTypesResource.value() ?? []
      : [],
  );

  private syncedMetaKey: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Sync local signals from metadata input each time the input changes.
    effect(() => {
      const meta = this.metadata();
      // Avoid re-syncing on every signal write originating from this panel.
      const key = `${meta.guid}|${meta.title}|${meta.status}|${meta.tags.join(',')}|${meta.pageType ?? ''}`;
      if (this.syncedMetaKey === key) return;
      this.syncedMetaKey = key;
      this.title.set(meta.title);
      this.tags.set([...meta.tags]);
      this.status.set(meta.status);
      this.pageType.set(meta.pageType ?? null);
      // A metadata change from the host is not a user Title edit.
      this.userTitleDirty = false;
      if (meta.title.trim() !== '') this.lastNonEmptyTitle = meta.title;
    });


    // Debounced emit of the merged metadata.
    effect(() => {
      // Track the editable fields so the debounce re-arms on any change.
      this.title();
      this.tags();
      this.status();
      this.pageType();
      if (this.readOnly()) return;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.flushMetadata(), DEBOUNCE_MS);
    });

    this.destroyRef.onDestroy(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
    });
  }

  /** Enter click-to-edit mode (no-op when read-only), then focus + select. */
  startEditing(): void {
    if (this.readOnly()) return;
    this.editing.set(true);
    // After the input has rendered and ngModel has written its value, focus it
    // and select the text (React parity for the click-to-edit affordance).
    afterNextRender(
      () => {
        const el = this.titleInputEl()?.nativeElement;
        if (!el) return;
        el.focus();
        el.select();
      },
      { injector: this.injector },
    );
  }

  /** Title `ngModelChange`: record the keystroke and track the last non-empty value. */
  onTitleInput(value: string): void {
    this.title.set(value);
    this.userTitleDirty = true;
    if (value.trim() !== '') this.lastNonEmptyTitle = value;
  }

  /**
   * Leave click-to-edit mode. A blank/whitespace title is reverted to the last
   * non-empty value and flushed immediately so an empty title is never
   * persisted; the revert is not treated as a user Title edit, so it triggers
   * no H1 rewrite.
   */
  onTitleBlur(): void {
    this.editing.set(false);
    if (this.title().trim() === '') {
      // Revert a blank field to the last non-empty value and flush now.
      // `userTitleDirty` is left exactly as the last real keystroke set it: if
      // the user retyped a new title and then blanked it inside one debounce
      // window, the reverted value still has to reach the buffer H1. A
      // redundant `titleH1Sync` here is harmless — the host's `rewriteFirstH1`
      // reference-equal no-op drops it when the H1 already matches.
      this.title.set(this.lastNonEmptyTitle);
      this.flushMetadata();
    }
  }

  /** Enter / Escape in the Title input commits and closes the editor. */
  onTitleEnter(): void {
    this.titleInputEl()?.nativeElement.blur();
  }

  /**
   * Build the merged metadata and emit it (plus, for a genuine non-empty user
   * Title edit, {@link titleH1Sync}). Called from the debounce timer and
   * directly on a blank-title revert. Never emits an empty title.
   */
  private flushMetadata(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.readOnly()) return;

    const t = this.title();
    if (t.trim() === '') return; // never persist an empty title

    const tg = this.tags();
    const st = this.status();
    const pt = this.pageType();
    const current = this.metadata();
    const next: PageMetadata = {
      ...current,
      title: t,
      tags: [...tg],
      status: st,
      ...(pt !== null ? { pageType: pt } : {}),
    };
    if (pt === null && 'pageType' in next) {
      delete (next as { pageType?: string }).pageType;
    }
    // Update sync key so the next metadata-input echo doesn't reset us.
    this.syncedMetaKey = `${next.guid}|${next.title}|${next.status}|${next.tags.join(',')}|${next.pageType ?? ''}`;
    this.metadataChange.emit(next);
    if (this.userTitleDirty) this.titleH1Sync.emit(t);
  }

  /**
   * Page Type `<mat-select>` change. Updates the local signal (so the debounced
   * {@link metadataChange} carries the new type too) and, unless read-only,
   * emits {@link pageTypeChange} at once. `next` is `null` for "(none)".
   *
   * - A real type → payload carries `properties` merged against that type's
   *   schema ({@link mergeSchema}).
   * - "(none)" → payload carries `pageType: null` only; the stored properties
   *   are left untouched (no wipe).
   *
   * Re-selecting the current type is a no-op (trailing-edge guard) so it does
   * not trigger a redundant persist + invalidation.
   */
  onPageTypeChange(next: string | null): void {
    if (next === (this.metadata().pageType ?? null)) return;
    this.pageType.set(next);
    if (this.readOnly()) return;
    if (next === null) {
      this.pageTypeChange.emit({ pageType: null });
      return;
    }
    const schema = this.allTypes().find((t) => t.guid === next)?.properties ?? [];
    this.pageTypeChange.emit({
      pageType: next,
      properties: mergeSchema(this.metadata().properties, schema),
    });
  }

  addTag(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim();
    if (!value) {
      event.chipInput?.clear();
      return;
    }
    if (!this.tags().includes(value)) {
      this.tags.update((arr) => [...arr, value]);
    }
    event.chipInput?.clear();
  }

  removeTag(tag: string): void {
    this.tags.update((arr) => arr.filter((t) => t !== tag));
  }
}
