import { Injectable } from '@angular/core';
import type { Observable} from 'rxjs';
import { Subject } from 'rxjs';

import type { PageUpsert } from '../../features/pages/page.types';

export interface PageUpsertBatch {
  pages: PageUpsert[];
  /** `remote`: another tab/client saved (via {@link Realtime}); `local`: our own PUT result. */
  source: 'remote' | 'local';
}

/**
 * Saved-page summaries to patch into lists in place — board cards, tree rows,
 * breadcrumbs — instead of refetching them. An event stream rather than a
 * signal: every batch must reach subscribers, and a signal would coalesce two
 * batches arriving in the same tick.
 */
@Injectable({ providedIn: 'root' })
export class PageUpserts {
  private readonly subject = new Subject<PageUpsertBatch>();
  readonly batches$: Observable<PageUpsertBatch> = this.subject.asObservable();

  emit(pages: PageUpsert[], source: PageUpsertBatch['source']): void {
    if (pages.length > 0) this.subject.next({ pages, source });
  }
}
