import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  PageTypes,
  type CreatePageTypeRequest,
  type UpdatePageTypeRequest,
} from './page-types';
import type {
  PageTypeDefinition,
  PageTypeProperty,
  PropertyType,
} from '../pages/page.types';
import { ConfirmDialog, type ConfirmDialogData } from '../../shared/components/confirm-dialog';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'tags', label: 'Tags' },
];

function kebabify(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function parseDefault(
  type: PropertyType,
  raw: string,
): string | number | string[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  switch (type) {
    case 'number': {
      const n = Number(trimmed);
      return Number.isNaN(n) ? undefined : n;
    }
    case 'tags':
      return trimmed
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    default:
      return trimmed;
  }
}

function formatDefault(prop: PageTypeProperty): string {
  if (prop.defaultValue === undefined || prop.defaultValue === null) return '';
  if (Array.isArray(prop.defaultValue)) return prop.defaultValue.join(', ');
  return String(prop.defaultValue);
}

@Component({
  selector: 'wiki-page-types-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="admin">
      <header class="admin-header">
        <h1>Page Types</h1>
        <button mat-flat-button color="primary" type="button" (click)="onNew()">
          New page type
        </button>
      </header>

      @if (resource.isLoading()) {
        <p class="state">Loading page types...</p>
      } @else if (resource.error()) {
        <p class="state error">Failed to load page types.</p>
      } @else {
        <div class="layout">
          <section class="list" aria-label="Page types">
            @for (pt of pageTypes(); track pt.guid) {
              <mat-card class="row" [class.selected]="selectedGuid() === pt.guid">
                <div class="row-body">
                  <span class="icon">{{ pt.icon }}</span>
                  <div class="text">
                    <strong>{{ pt.name }}</strong>
                    <small>
                      {{ pt.properties.length }} properties
                      @if (pt.allowedChildTypes.length) {
                        | {{ pt.allowedChildTypes.length }} child types
                      }
                    </small>
                  </div>
                  <div class="row-actions">
                    <button
                      mat-stroked-button
                      type="button"
                      [attr.aria-label]="'Edit ' + pt.name"
                      (click)="onSelect(pt)"
                    >
                      Edit
                    </button>
                    <button
                      mat-stroked-button
                      color="warn"
                      type="button"
                      [attr.aria-label]="'Delete ' + pt.name"
                      (click)="onDelete(pt)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </mat-card>
            } @empty {
              <p class="state">No page types defined yet.</p>
            }
          </section>

          @if (mode() !== 'idle') {
            <section class="editor" aria-label="Editor">
              <h2>
                @if (mode() === 'create') {
                  New Page Type
                } @else {
                  Edit: {{ form().name }}
                }
              </h2>

              <mat-form-field appearance="fill" class="full">
                <mat-label>Name</mat-label>
                <input
                  matInput
                  type="text"
                  required
                  minlength="1"
                  maxlength="50"
                  [ngModel]="form().name"
                  (ngModelChange)="updateName($event)"
                />
              </mat-form-field>

              <mat-form-field appearance="fill" class="icon-field">
                <mat-label>Icon</mat-label>
                <input
                  matInput
                  type="text"
                  maxlength="4"
                  [ngModel]="form().icon"
                  (ngModelChange)="updateIcon($event)"
                />
              </mat-form-field>

              <h3>Properties</h3>
              <div class="prop-list">
                @for (prop of form().properties; track prop.name; let i = $index) {
                  <div class="prop-row">
                    <span class="prop-name">{{ prop.name }}</span>
                    <span class="prop-type">{{ prop.type }}</span>
                    @if (prop.required) {
                      <span class="prop-required">required</span>
                    }
                    <input
                      class="prop-default"
                      type="text"
                      [value]="formatDefault(prop)"
                      (input)="updatePropertyDefault(i, $any($event.target).value)"
                      placeholder="default"
                    />
                    <button
                      mat-icon-button
                      type="button"
                      [attr.aria-label]="'Remove property ' + prop.name"
                      (click)="removeProperty(i)"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                } @empty {
                  <p class="state">No properties.</p>
                }
              </div>

              <div class="add-prop">
                <mat-form-field appearance="fill" class="add-name">
                  <mat-label>Property name</mat-label>
                  <input
                    matInput
                    type="text"
                    [ngModel]="newPropName()"
                    (ngModelChange)="newPropName.set($event)"
                  />
                </mat-form-field>
                <mat-form-field appearance="fill" class="add-type">
                  <mat-label>Type</mat-label>
                  <mat-select
                    [ngModel]="newPropType()"
                    (ngModelChange)="newPropType.set($event)"
                  >
                    @for (t of propertyTypes; track t.value) {
                      <mat-option [value]="t.value">{{ t.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-checkbox
                  [ngModel]="newPropRequired()"
                  (ngModelChange)="newPropRequired.set($event)"
                >
                  Required
                </mat-checkbox>
                <button
                  mat-stroked-button
                  type="button"
                  [disabled]="!newPropName().trim()"
                  (click)="addProperty()"
                >
                  Add property
                </button>
              </div>

              @if (otherTypes().length > 0) {
                <h3>Allowed Child Types</h3>
                <div class="multi">
                  @for (t of otherTypes(); track t.guid) {
                    <mat-checkbox
                      [ngModel]="form().allowedChildTypes.includes(t.guid)"
                      (ngModelChange)="toggleChildType(t.guid)"
                    >
                      {{ t.icon }} {{ t.name }}
                    </mat-checkbox>
                  }
                </div>
              }

              <mat-slide-toggle
                [ngModel]="form().allowWikiPageChildren"
                (ngModelChange)="updateAllowWikiPageChildren($event)"
              >
                Allow untyped wiki pages as children
              </mat-slide-toggle>

              @if (otherTypes().length > 0) {
                <h3>Allowed Parent Types</h3>
                <div class="multi">
                  @for (t of otherTypes(); track t.guid) {
                    <mat-checkbox
                      [ngModel]="form().allowedParentTypes.includes(t.guid)"
                      (ngModelChange)="toggleParentType(t.guid)"
                    >
                      {{ t.icon }} {{ t.name }}
                    </mat-checkbox>
                  }
                </div>
              }

              <mat-slide-toggle
                [ngModel]="form().allowAnyParent"
                (ngModelChange)="updateAllowAnyParent($event)"
              >
                Allow placement under untyped wiki pages
              </mat-slide-toggle>

              @if (errorMessage(); as msg) {
                <p class="error">{{ msg }}</p>
              }

              <div class="actions">
                <button mat-button type="button" (click)="onCancel()">Cancel</button>
                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="!canSave() || saving()"
                  (click)="onSave()"
                >
                  @if (saving()) {
                    <mat-progress-spinner diameter="18" mode="indeterminate" />
                  } @else {
                    Save
                  }
                </button>
              </div>
            </section>
          }
        </div>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .admin { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
      .admin-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
      .layout { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(360px, 2fr); gap: 1.5rem; }
      .list { display: flex; flex-direction: column; gap: 0.5rem; }
      .row.selected { outline: 2px solid #1976d2; }
      .row-body { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; }
      .icon { font-size: 1.5rem; }
      .text { flex: 1; display: flex; flex-direction: column; }
      .row-actions { display: flex; gap: 0.5rem; }
      .editor { display: flex; flex-direction: column; gap: 0.75rem; background: #fafafa; padding: 1rem; border-radius: 8px; }
      .full { width: 100%; }
      .icon-field { width: 8rem; }
      .prop-list { display: flex; flex-direction: column; gap: 0.25rem; }
      .prop-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem; background: #f0f0f0; border-radius: 4px; }
      .prop-name { font-family: monospace; flex: 1; }
      .prop-type { color: #6b7280; font-size: 0.875rem; }
      .prop-required { background: #fee2e2; color: #b91c1c; padding: 0 0.25rem; border-radius: 4px; font-size: 0.75rem; }
      .prop-default { width: 8rem; padding: 0.25rem; }
      .add-prop { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
      .add-name { flex: 1; min-width: 12rem; }
      .add-type { width: 8rem; }
      .multi { display: flex; flex-direction: column; gap: 0.25rem; }
      .actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
      .state { padding: 0.5rem; color: #6b7280; }
      .error { color: #b91c1c; }
    `,
  ],
})
export class PageTypesAdmin {
  private readonly pageTypesService = inject(PageTypes);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly propertyTypes = PROPERTY_TYPES;

  readonly resource = this.pageTypesService.pageTypesResource();

  protected readonly pageTypes = computed<PageTypeDefinition[]>(() => {
    if (this.resource.status() !== 'resolved') return [];
    return this.resource.value() ?? [];
  });

  protected readonly selectedGuid = signal<string | null>(null);
  protected readonly mode = signal<'idle' | 'create' | 'edit'>('idle');
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = signal<{
    name: string;
    icon: string;
    properties: PageTypeProperty[];
    allowedChildTypes: string[];
    allowWikiPageChildren: boolean;
    allowedParentTypes: string[];
    allowAnyParent: boolean;
  }>(emptyForm());

  protected readonly newPropName = signal('');
  protected readonly newPropType = signal<PropertyType>('string');
  protected readonly newPropRequired = signal(false);

  protected readonly otherTypes = computed(() => {
    const selected = this.selectedGuid();
    return this.pageTypes().filter((t) => t.guid !== selected);
  });

  protected readonly canSave = computed(() => {
    const f = this.form();
    return f.name.trim().length > 0 && f.icon.trim().length > 0;
  });

  constructor() {
    // Reset the editor when the selected type disappears from the list (e.g. after delete).
    effect(() => {
      const guid = this.selectedGuid();
      if (!guid) return;
      const list = this.pageTypes();
      if (list.length === 0) return;
      if (!list.some((t) => t.guid === guid)) {
        this.selectedGuid.set(null);
        this.mode.set('idle');
      }
    });
  }

  protected formatDefault(p: PageTypeProperty): string {
    return formatDefault(p);
  }

  onNew(): void {
    this.selectedGuid.set(null);
    this.form.set(emptyForm());
    this.errorMessage.set(null);
    this.mode.set('create');
  }

  onSelect(pt: PageTypeDefinition): void {
    this.selectedGuid.set(pt.guid);
    this.form.set({
      name: pt.name,
      icon: pt.icon,
      properties: [...pt.properties],
      allowedChildTypes: [...pt.allowedChildTypes],
      allowWikiPageChildren: pt.allowWikiPageChildren,
      allowedParentTypes: [...pt.allowedParentTypes],
      allowAnyParent: pt.allowAnyParent,
    });
    this.errorMessage.set(null);
    this.mode.set('edit');
  }

  onCancel(): void {
    this.selectedGuid.set(null);
    this.form.set(emptyForm());
    this.mode.set('idle');
    this.errorMessage.set(null);
  }

  updateName(value: string): void {
    this.form.update((f) => ({ ...f, name: value }));
  }

  updateIcon(value: string): void {
    this.form.update((f) => ({ ...f, icon: value }));
  }

  updateAllowWikiPageChildren(value: boolean): void {
    this.form.update((f) => ({ ...f, allowWikiPageChildren: value }));
  }

  updateAllowAnyParent(value: boolean): void {
    this.form.update((f) => ({ ...f, allowAnyParent: value }));
  }

  toggleChildType(guid: string): void {
    this.form.update((f) => ({
      ...f,
      allowedChildTypes: f.allowedChildTypes.includes(guid)
        ? f.allowedChildTypes.filter((g) => g !== guid)
        : [...f.allowedChildTypes, guid],
    }));
  }

  toggleParentType(guid: string): void {
    this.form.update((f) => ({
      ...f,
      allowedParentTypes: f.allowedParentTypes.includes(guid)
        ? f.allowedParentTypes.filter((g) => g !== guid)
        : [...f.allowedParentTypes, guid],
    }));
  }

  addProperty(): void {
    const name = kebabify(this.newPropName());
    if (!name) return;
    if (this.form().properties.some((p) => p.name === name)) {
      this.errorMessage.set(`Property "${name}" already exists.`);
      return;
    }
    const next: PageTypeProperty = {
      name,
      type: this.newPropType(),
      required: this.newPropRequired(),
    };
    this.form.update((f) => ({ ...f, properties: [...f.properties, next] }));
    this.newPropName.set('');
    this.newPropType.set('string');
    this.newPropRequired.set(false);
    this.errorMessage.set(null);
  }

  removeProperty(index: number): void {
    this.form.update((f) => ({
      ...f,
      properties: f.properties.filter((_, i) => i !== index),
    }));
  }

  updatePropertyDefault(index: number, raw: string): void {
    this.form.update((f) => {
      const next = [...f.properties];
      const target = next[index];
      const defaultValue = parseDefault(target.type, raw);
      next[index] = { ...target, defaultValue };
      return { ...f, properties: next };
    });
  }

  async onSave(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    const f = this.form();
    const body: CreatePageTypeRequest = {
      name: f.name.trim(),
      icon: f.icon.trim(),
      properties: f.properties,
      allowedChildTypes: f.allowedChildTypes,
      allowWikiPageChildren: f.allowWikiPageChildren,
      allowedParentTypes: f.allowedParentTypes,
      allowAnyParent: f.allowAnyParent,
    };
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const guid = this.selectedGuid();
      if (this.mode() === 'edit' && guid) {
        const update: UpdatePageTypeRequest = body;
        await this.pageTypesService.updatePageType(guid, update);
      } else {
        await this.pageTypesService.createPageType(body);
      }
      this.selectedGuid.set(null);
      this.form.set(emptyForm());
      this.mode.set('idle');
    } catch (err) {
      this.errorMessage.set(this.toMessage(err, 'Failed to save page type.'));
    } finally {
      this.saving.set(false);
    }
  }

  onDelete(pt: PageTypeDefinition): void {
    const data: ConfirmDialogData = {
      title: 'Delete page type',
      message: `Delete "${pt.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(
      ConfirmDialog,
      { data },
    );
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      void this.runDelete(pt.guid);
    });
  }

  private async runDelete(guid: string): Promise<void> {
    try {
      await this.pageTypesService.deletePageType(guid);
    } catch (err) {
      this.snack.open(this.toMessage(err, 'Failed to delete page type.'), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const m = (err as { message?: unknown }).message;
      if (typeof m === 'string') return m;
    }
    return fallback;
  }
}

function emptyForm(): {
  name: string;
  icon: string;
  properties: PageTypeProperty[];
  allowedChildTypes: string[];
  allowWikiPageChildren: boolean;
  allowedParentTypes: string[];
  allowAnyParent: boolean;
} {
  return {
    name: '',
    icon: '📄',
    properties: [],
    allowedChildTypes: [],
    allowWikiPageChildren: true,
    allowedParentTypes: [],
    allowAnyParent: true,
  };
}
