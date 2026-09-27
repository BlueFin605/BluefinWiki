import { Injectable, signal } from '@angular/core';
import type { PageSummary } from './page.types';

/**
 * Step 2.2: the page currently being dragged anywhere in the page tree.
 *
 * `PageTreeItem`'s type-constraint feedback (amber row + warning triangle +
 * reasons) has to render on a row the pointer is *hovering* — but
 * `cdkDropListEnterPredicate` returning `false` for a disallowed target means
 * CDK never fires `cdkDropListEntered` there, so a rejected row gets no CDK
 * event and cannot learn what is being dragged. This service carries the
 * dragged `PageSummary` across every row: the source row sets it on
 * `cdkDragStarted` and clears it on `cdkDragEnded`, and every other row reads
 * it from `mousemove` to compute `checkTypeConstraints`.
 *
 * Only one page tree is ever mounted (`pages-view` owns it), so a root-provided
 * singleton is effectively tree-scoped; the state resets itself to `null` after
 * each drag.
 */
@Injectable({ providedIn: 'root' })
export class TreeDragState {
  private readonly _dragged = signal<PageSummary | null>(null);

  /** The page being dragged, or `null` when no tree drag is in progress. */
  readonly dragged = this._dragged.asReadonly();

  start(page: PageSummary): void {
    this._dragged.set(page);
  }

  end(): void {
    this._dragged.set(null);
  }
}
