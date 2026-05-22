import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
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
      <mat-form-field appearance="fill" class="full">
        <mat-label>Title</mat-label>
        <input
          matInput
          type="text"
          [disabled]="readOnly()"
          [ngModel]="title()"
          (ngModelChange)="title.set($event)"
        />
      </mat-form-field>

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

      <mat-form-field appearance="fill" class="full">
        <mat-label>Page type</mat-label>
        <mat-select
          [disabled]="readOnly()"
          [ngModel]="pageType()"
          (ngModelChange)="pageType.set($event)"
        >
          <mat-option [value]="null">(none)</mat-option>
          @for (t of allTypes(); track t.guid) {
            <mat-option [value]="t.guid">{{ t.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

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
    .meta { display: grid; grid-template-columns: max-content 1fr; column-gap: 0.5rem; row-gap: 0.25rem; color: #6b7280; font-size: 0.875rem; margin: 0; }
    .meta dt { font-weight: 600; }
    .meta dd { margin: 0; }
  `],
})
export class PagePropertiesPanel {
  private readonly pageTypes = inject(PageTypes);
  private readonly destroyRef = inject(DestroyRef);

  readonly metadata = input.required<PageMetadata>();
  readonly readOnly = input<boolean>(false);
  readonly metadataChange = output<PageMetadata>();

  protected readonly separatorKeyCodes = [ENTER, COMMA] as const;

  // Local copies so the chip + select bindings can write back without
  // mutating the input metadata.
  protected readonly title = signal('');
  protected readonly tags = signal<readonly string[]>([]);
  protected readonly status = signal<PageMetadata['status']>('draft');
  protected readonly pageType = signal<string | null>(null);

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
    });

    // Debounced emit of the merged metadata.
    effect(() => {
      const t = this.title();
      const tg = this.tags();
      const st = this.status();
      const pt = this.pageType();
      if (this.readOnly()) return;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
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
      }, DEBOUNCE_MS);
    });

    this.destroyRef.onDestroy(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
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
