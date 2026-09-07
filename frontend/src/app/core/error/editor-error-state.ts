import { Injectable, signal } from '@angular/core';

export interface EditorError {
  message: string;
}

/**
 * Holds the most recent unhandled editor error. The `GlobalErrorHandler`
 * writes here; `PageDetail` reads here to render an inline retry panel and
 * to bump a remount-key for the CodeMirror surface.
 */
@Injectable({ providedIn: 'root' })
export class EditorErrorState {
  private readonly _current = signal<EditorError | null>(null);
  private readonly _version = signal(0);

  readonly current = this._current.asReadonly();
  readonly version = this._version.asReadonly();

  setError(message: string): void {
    this._current.set({ message });
    this._version.update((v) => v + 1);
  }

  clear(): void {
    this._current.set(null);
  }
}
