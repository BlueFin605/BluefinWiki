import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, type ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Pages } from './pages';

@Component({
  selector: 'wiki-page-rename-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rename-overlay" (click)="onBackdrop($event)" (keydown)="onOverlayKey($event)" role="presentation">
      <div class="rename-dialog" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Rename page">
        <h3>Rename page</h3>
        <input
          #titleInput
          type="text"
          [(ngModel)]="value"
          (keydown)="onKey($event)"
          [class.invalid]="error()"
          aria-label="Page title"
        />
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="actions">
          <button type="button" (click)="cancel()">Cancel</button>
          <button type="button" (click)="save()" [disabled]="busy()">Save</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rename-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .rename-dialog { background: white; padding: 1.5rem; border-radius: 8px; width: 24rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .rename-dialog h3 { margin: 0 0 1rem 0; }
    input { width: 100%; padding: 0.5rem; border: 2px solid #cbd5e1; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
    input:focus { outline: none; border-color: #2563eb; }
    input.invalid { border-color: #dc2626; }
    .error { color: #dc2626; font-size: 0.875rem; margin: 0.5rem 0 0 0; }
    .actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    button { padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    button[disabled] { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class PageRenameInline {
  private readonly pages = inject(Pages);

  readonly guid = input.required<string>();
  readonly initialTitle = input.required<string>();

  readonly completed = output<string>();
  readonly cancelled = output<void>();

  readonly value = signal('');
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();
  readonly busy = signal(false);

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  constructor() {
    afterNextRender(() => {
      this.value.set(this.initialTitle());
      const el = this.titleInput()?.nativeElement;
      if (el) {
        el.focus();
        el.select();
      }
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  onBackdrop(event: MouseEvent): void {
    event.stopPropagation();
    this.cancelled.emit();
  }

  onOverlayKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }

  async save(): Promise<void> {
    const trimmed = this.value().trim();
    if (trimmed === this.initialTitle()) {
      this.completed.emit(this.guid());
      return;
    }
    if (trimmed.length < 3) {
      this._error.set('Title must be at least 3 characters');
      return;
    }
    if (trimmed.length > 100) {
      this._error.set('Title must be less than 100 characters');
      return;
    }
    this._error.set(null);
    this.busy.set(true);
    try {
      await this.pages.updatePage(this.guid(), { title: trimmed });
      this.completed.emit(this.guid());
    } catch {
      this._error.set('Failed to rename. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
