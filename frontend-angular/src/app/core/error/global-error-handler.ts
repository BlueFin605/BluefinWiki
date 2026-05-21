import { Injectable, inject } from '@angular/core';
import type { ErrorHandler } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private snack = inject(MatSnackBar);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);
    this.snack.open('Something went wrong — try again.', 'Reload', { duration: 6000 })
      .onAction()
      .subscribe(() => window.location.reload());
  }
}
