import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Shared back-navigation affordance for admin/settings/profile screens.
 *
 * React parity: a back chevron that always navigates to `/pages` (not
 * `history.back()`), paired with the screen's title.
 */
@Component({
  selector: 'wiki-admin-back-header',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      aria-label="Back to pages"
      (click)="router.navigate(['/pages'])"
    >
      <mat-icon>arrow_back</mat-icon>
    </button>
    <h1>{{ title() }}</h1>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
    }
  `],
})
export class AdminBackHeader {
  protected readonly router = inject(Router);

  readonly title = input.required<string>();
}
