import { HttpClient } from '@angular/common/http';
import { Injectable, type Signal, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import type { PageTypeDefinition } from '../pages/page.types';

/**
 * Sentinel value: pass as the guid signal value to disable the fetch entirely.
 * Mirrors `Pages.SKIP_CHILDREN_FETCH` so consumers can pause requests without
 * special-casing null (which they may need for other meanings).
 */
export const SKIP_PAGE_TYPE_FETCH: unique symbol = Symbol('SKIP_PAGE_TYPE_FETCH');

interface AllowedChildrenResponse {
  allowedChildTypes: PageTypeDefinition[];
  allowWikiPageChildren: boolean;
}

@Injectable({ providedIn: 'root' })
export class PageTypes {
  private readonly http = inject(HttpClient);
  private readonly _version = signal(0);

  bumpVersion(): void {
    this._version.update((v) => v + 1);
  }

  /** All defined page types (read-only in Phase 4; Phase 6 admin component will mutate). */
  pageTypesResource() {
    return rxResource({
      params: () => this._version(),
      stream: () =>
        this.http
          .get<{ pageTypes: PageTypeDefinition[] }>('/api/page-types')
          .pipe(map((r) => r.pageTypes ?? [])),
    });
  }

  pageTypeResource(guid: Signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>) {
    return rxResource({
      params: () => ({ guid: guid(), v: this._version() }),
      stream: ({ params }) => {
        const g = params.guid;
        if (g === SKIP_PAGE_TYPE_FETCH || typeof g !== 'string') {
          throw new Error('pageTypeResource: fetch disabled');
        }
        return this.http.get<PageTypeDefinition>(`/api/page-types/${g}`);
      },
    });
  }

  allowedChildTypesResource(parentTypeGuid: Signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>) {
    return rxResource({
      params: () => ({ guid: parentTypeGuid(), v: this._version() }),
      stream: ({ params }) => {
        const g = params.guid;
        if (g === SKIP_PAGE_TYPE_FETCH || typeof g !== 'string') {
          throw new Error('allowedChildTypesResource: fetch disabled');
        }
        return this.http.get<AllowedChildrenResponse>(
          `/api/page-types/${g}/allowed-children`,
        );
      },
    });
  }
}
