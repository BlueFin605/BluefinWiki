import { Injectable, signal } from '@angular/core';

export interface EditorError {
  message: string;
}

/**
 * Holds the most recent editor-interaction error.
 *
 * Written by `PageDetail`'s editor-interaction handlers
 * (`onAction` / `onPickPage` / `onInsertMarkdown`) when a CodeMirror call
 * throws. Read by `PageDetail` to render the inline crash panel in place of the
 * editor. Cleared by `PageDetail` when the page identity changes and by
 * `reloadEditor()` ("Try Again").
 */
@Injectable({ providedIn: 'root' })
export class EditorErrorState {
  private readonly _current = signal<EditorError | null>(null);

  readonly current = this._current.asReadonly();

  setError(message: string): void {
    this._current.set({ message });
  }

  clear(): void {
    this._current.set(null);
  }
}
