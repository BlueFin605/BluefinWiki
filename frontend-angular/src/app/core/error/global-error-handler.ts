import { Injectable, inject } from '@angular/core';
import type { ErrorHandler } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditorErrorState } from './editor-error-state';

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private snack = inject(MatSnackBar);
  private editorErrorState = inject(EditorErrorState);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);
    const message =
      error instanceof Error ? error.message : 'Something went wrong.';
    this.editorErrorState.setError(message);
    this.snack.open('Something went wrong — try again.', 'Reload', { duration: 6000 })
      .onAction()
      .subscribe(() => window.location.reload());
  }
}
