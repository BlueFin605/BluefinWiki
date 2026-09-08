import { HttpClient } from '@angular/common/http';
import { Injectable, type Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import {
  InvalidationBus,
  allowedChildrenTag,
  pageTypeTag,
  pageTypesListTag,
} from '../../core/api/invalidation';
import type { PageTypeDefinition, PageTypeProperty } from '../pages/page.types';

export interface CreatePageTypeRequest {
  name: string;
  icon: string;
  properties?: PageTypeProperty[];
  allowedChildTypes?: string[];
  allowWikiPageChildren?: boolean;
  allowedParentTypes?: string[];
  allowAnyParent?: boolean;
}

export type UpdatePageTypeRequest = Partial<CreatePageTypeRequest>;

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
  private readonly bus = inject(InvalidationBus);

  /** All defined page types. Keys on `page-types:list`. */
  pageTypesResource() {
    return rxResource({
      params: () => this.bus.version(pageTypesListTag()),
      stream: () =>
        this.http
          .get<{ pageTypes: PageTypeDefinition[] }>('/api/page-types')
          .pipe(map((r) => r.pageTypes ?? [])),
    });
  }

  pageTypeResource(guid: Signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>) {
    return rxResource({
      params: () => {
        const g = guid();
        return {
          guid: g,
          v: typeof g === 'string' ? this.bus.version(pageTypeTag(g)) : 0,
        };
      },
      stream: ({ params }) => {
        const g = params.guid;
        if (g === SKIP_PAGE_TYPE_FETCH || typeof g !== 'string') {
          throw new Error('pageTypeResource: fetch disabled');
        }
        return this.http.get<PageTypeDefinition>(`/api/page-types/${g}`);
      },
    });
  }

  async createPageType(body: CreatePageTypeRequest): Promise<PageTypeDefinition> {
    const result = await firstValueFrom(
      this.http.post<PageTypeDefinition>('/api/page-types', body),
    );
    this.bus.bump(pageTypesListTag());
    return result;
  }

  async updatePageType(
    guid: string,
    body: UpdatePageTypeRequest,
  ): Promise<PageTypeDefinition> {
    const result = await firstValueFrom(
      this.http.put<PageTypeDefinition>(`/api/page-types/${guid}`, body),
    );
    this.bus.bumpMany([pageTypesListTag(), pageTypeTag(guid)]);
    return result;
  }

  async deletePageType(guid: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`/api/page-types/${guid}`));
    this.bus.bumpMany([pageTypesListTag(), pageTypeTag(guid)]);
  }

  /**
   * Keys on `page-type:allowed-children:<guid>` AND `page-types:list` — the
   * allowed-children set is derived from the full type set, so a create/
   * update/delete of any type may change it.
   */
  allowedChildTypesResource(parentTypeGuid: Signal<string | null | typeof SKIP_PAGE_TYPE_FETCH>) {
    return rxResource({
      params: () => {
        const g = parentTypeGuid();
        return {
          guid: g,
          v: typeof g === 'string' ? this.bus.version(allowedChildrenTag(g)) : 0,
          list: this.bus.version(pageTypesListTag()),
        };
      },
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
