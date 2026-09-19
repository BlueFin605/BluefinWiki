import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminTasks, type RebuildResult } from './admin-tasks';
import { AdminBackHeader } from '../../shared/components/admin-back-header';

@Component({
  selector: 'wiki-rebuild-page-index',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    AdminBackHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <wiki-admin-back-header title="Rebuild Page Index" />
      </header>
      <mat-card class="card">
        <p>
          The page index maps each page GUID to its S3 location. Rebuilding walks
          every page in S3, refreshes index rows, and removes orphan rows.
        </p>
        <p>
          Use this when pages have been deleted or modified directly in S3 and the
          index has gone stale. Reads may be slower while the rebuild runs.
        </p>

        @if (running()) {
          <div class="state">
            <mat-progress-spinner diameter="24" mode="indeterminate" />
            <span>Rebuild in progress — please don't close this page.</span>
          </div>
        } @else if (confirming()) {
          <div class="confirm">
            <p>
              This will scan the entire pages bucket and overwrite every row in
              the page index, then delete any orphan rows. It may take several
              minutes. Continue?
            </p>
            <div class="confirm-actions">
              <button mat-button type="button" (click)="onCancelConfirm()">
                Cancel
              </button>
              <button
                mat-flat-button
                color="primary"
                type="button"
                (click)="onConfirmRebuild()"
              >
                Yes, rebuild
              </button>
            </div>
          </div>
        } @else {
          <button
            mat-flat-button
            color="primary"
            type="button"
            (click)="onRebuild()"
          >
            Rebuild now
          </button>
        }

        @if (result(); as r) {
          <section class="result" aria-label="Rebuild result">
            <h2>Rebuild complete</h2>
            <dl>
              <dt>Pages discovered</dt><dd>{{ r.totalPages }}</dd>
              <dt>Rows written</dt><dd>{{ r.indexed }}</dd>
              <dt>Orphan rows deleted</dt><dd>{{ r.deletedOrphans }}</dd>
              <dt>Failed</dt><dd>{{ r.failed }}</dd>
              <dt>Duration (s)</dt><dd>{{ formatDuration(r.durationMs) }}</dd>
            </dl>
            @if (r.errors.length > 0) {
              <details>
                <summary>{{ r.errors.length }} error(s)</summary>
                <ul>
                  @for (e of r.errors; track e) {
                    <li>{{ e }}</li>
                  }
                </ul>
              </details>
            }
            @if (r.orphanGuids.length > 0) {
              <details>
                <summary>{{ r.orphanGuids.length }} deleted orphan GUID(s)</summary>
                <ul>
                  @for (g of r.orphanGuids; track g) {
                    <li>{{ g }}</li>
                  }
                </ul>
              </details>
            }
          </section>
        }
      </mat-card>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .page { padding: 1.5rem; max-width: 800px; margin: 0 auto; }
      .page-header { display: flex; align-items: center; margin-bottom: 1rem; }
      .card { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
      .state { display: flex; align-items: center; gap: 0.75rem; color: #6b7280; }
      .confirm { display: flex; flex-direction: column; gap: 0.75rem; }
      .confirm-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
      .result h2 { color: #2e7d32; margin: 0 0 0.5rem; }
      .result dl { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; }
      .result dt { color: #6b7280; }
    `,
  ],
})
export class RebuildPageIndex {
  private readonly tasks = inject(AdminTasks);
  private readonly snack = inject(MatSnackBar);

  protected readonly running = signal(false);
  protected readonly confirming = signal(false);
  protected readonly result = signal<RebuildResult | null>(null);

  onRebuild(): void {
    this.confirming.set(true);
  }

  onCancelConfirm(): void {
    this.confirming.set(false);
  }

  onConfirmRebuild(): void {
    this.confirming.set(false);
    void this.run();
  }

  private async run(): Promise<void> {
    this.running.set(true);
    this.result.set(null);
    try {
      const r = await this.tasks.rebuildPageIndex();
      this.result.set(r);
      this.snack.open('Rebuild complete.', 'Dismiss', { duration: 4000 });
    } catch (err) {
      this.snack.open(this.toMessage(err, 'Failed to rebuild page index.'), 'Dismiss', {
        duration: 6000,
      });
    } finally {
      this.running.set(false);
    }
  }

  protected formatDuration(ms: number): string {
    return (ms / 1000).toFixed(1);
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    return fallback;
  }
}
