import { HttpClient } from '@angular/common/http';
import { Injectable, type Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import {
  InvalidationBus,
  ancestorsAnyTag,
  ancestorsTag,
  backlinksAnyTag,
  backlinksTag,
  childrenAnyTag,
  childrenTag,
  pageTag,
} from '../../core/api/invalidation';
import type {
  PageContent,
  PageSummary,
  PageChildDetail,
  UpdatePageRequest,
  MovePageRequest,
  ReorderRequest,
  DeletePageRequest,
  CreatePageRequest,
} from './page.types';

interface ChildrenResponse { children: PageSummary[] }
interface AncestorsResponse { ancestors: PageSummary[] }
interface BacklinksResponse { guid: string; backlinks: Backlink[]; count: number }
interface PageSearchResponse { results: PageSearchResult[] }

interface LinkResolveMatch {
  guid: string;
  title: string;
  parentGuid: string | null;
  status: string;
  confidence: number;
  path: string;
}
interface LinkResolveResponse {
  query: string;
  matches: LinkResolveMatch[];
  exactMatch: boolean;
  ambiguous: boolean;
  exists: boolean;
}

/** Result of resolving a `[[wiki link]]` target to a concrete page. */
export interface WikiLinkResolution {
  /** The resolved page guid, or the original target when nothing matched. */
  guid: string;
  /** True only on an exact (confidence 1.0) match. */
  exists: boolean;
}

export interface ChildrenWithPropertiesOptions {
  targetTypeGuid?: string;
  depth?: number;
  limit?: number;
  cursor?: string | null;
}

export interface ChildrenWithPropertiesResponse {
  children: PageChildDetail[];
  hasMore?: boolean;
  nextCursor?: string | null;
}

export interface PageSearchResult {
  guid: string;
  title: string;
  path: string;
  folderId: string | null;
}

export interface Backlink {
  guid: string;
  title: string;
  path?: string;
  excerpt?: string;
}

/**
 * Sentinel value: pass as the parentGuid signal value to disable the
 * children fetch entirely (used by recursive tree items while collapsed).
 */
export const SKIP_CHILDREN_FETCH: unique symbol = Symbol('SKIP_CHILDREN_FETCH');

@Injectable({ providedIn: 'root' })
export class Pages {
  private readonly http = inject(HttpClient);
  private readonly bus = inject(InvalidationBus);

  /**
   * Reactive children resource. `parentGuid` is a signal so consumers can
   * switch the request without recreating the resource. Pass `null` for the
   * root level (the React app's `/pages/root/children` endpoint). Pass
   * the `SKIP_CHILDREN_FETCH` sentinel to disable the fetch entirely (used
   * by `PageTreeItem` while collapsed).
   *
   * Invalidation: keys on `children:<parentGuid|root>` plus the coarse
   * `children:any` (bumped by move/delete, whose owning parent is unknown).
   */
  childrenResource(parentGuid: Signal<string | null | typeof SKIP_CHILDREN_FETCH>) {
    return rxResource({
      params: () => {
        const pg = parentGuid();
        return {
          parentGuid: pg,
          v: pg === SKIP_CHILDREN_FETCH ? 0 : this.bus.version(childrenTag(pg)),
          any: this.bus.version(childrenAnyTag()),
        };
      },
      stream: ({ params }) => {
        const pg = params.parentGuid;
        if (pg === SKIP_CHILDREN_FETCH) {
          throw new Error('childrenResource: fetch disabled');
        }
        let path: string;
        if (typeof pg === 'string') {
          path = `/api/pages/${pg}/children`;
        } else {
          path = '/api/pages/root/children';
        }
        return this.http
          .get<ChildrenResponse>(path)
          .pipe(map((r) => r.children ?? []));
      },
    });
  }

  /**
   * Reactive page-content resource. Pass `null` to disable the fetch (the
   * resource value stays undefined). Keys on `page:<guid>`.
   */
  pageResource(guid: Signal<string | null>) {
    return rxResource({
      params: () => {
        const g = guid();
        return { guid: g, v: g ? this.bus.version(pageTag(g)) : 0 };
      },
      stream: ({ params }) => {
        if (!params.guid) {
          // Caller passed null — no request. Returning the existing value
          // would re-emit; instead emit a never-resolving stream by throwing.
          // Simpler: gate at the consumer with `@if (guid())` so this is unreachable.
          throw new Error('pageResource called with null guid');
        }
        return this.http.get<PageContent>(`/api/pages/${params.guid}`);
      },
    });
  }

  /**
   * Invalidation: keys on `ancestors:<guid>` plus the coarse `ancestors:any`
   * (bumped by move/rename, whose affected descendant guids are unknown at the
   * mutation site — a folder rename must still refresh every descendant's
   * breadcrumb).
   */
  ancestorsResource(guid: Signal<string | null>) {
    return rxResource({
      params: () => {
        const g = guid();
        return {
          guid: g,
          v: g ? this.bus.version(ancestorsTag(g)) : 0,
          any: this.bus.version(ancestorsAnyTag()),
        };
      },
      stream: ({ params }) => {
        if (!params.guid) throw new Error('ancestorsResource called with null guid');
        return this.http
          .get<AncestorsResponse>(`/api/pages/${params.guid}/ancestors`)
          .pipe(map((r) => r.ancestors ?? []));
      },
    });
  }

  backlinksResource(guid: Signal<string | null>) {
    return rxResource({
      params: () => {
        const g = guid();
        return {
          guid: g,
          v: g ? this.bus.version(backlinksTag(g)) : 0,
          any: this.bus.version(backlinksAnyTag()),
        };
      },
      stream: ({ params }) => {
        if (!params.guid) throw new Error('backlinksResource called with null guid');
        return this.http.get<BacklinksResponse>(`/api/pages/${params.guid}/backlinks`);
      },
    });
  }

  /**
   * Reactive child-list resource with full property metadata. Used by the
   * Board view, which groups cards by their `state` property.
   *
   * Pass `null` for `parentGuid` to disable the fetch. The `options` signal
   * may contribute `type=`, `depth=`, `limit=`, and `cursor=` query params.
   *
   * Invalidation: shares `children:<parentGuid|root>` with `childrenResource`
   * (the board must refresh when children change) plus the coarse
   * `children:any` (deep boards aggregate descendants whose owning parent is
   * not this `parentGuid`, so property/order edits bump the coarse tag).
   */
  childrenWithPropertiesResource(
    parentGuid: Signal<string | null>,
    options: Signal<ChildrenWithPropertiesOptions | null>,
  ) {
    return rxResource({
      params: () => {
        const pg = parentGuid();
        return {
          parentGuid: pg,
          opts: options() ?? {},
          v: pg ? this.bus.version(childrenTag(pg)) : 0,
          any: this.bus.version(childrenAnyTag()),
        };
      },
      stream: ({ params }) => {
        if (!params.parentGuid) {
          throw new Error('childrenWithPropertiesResource: parentGuid is null');
        }
        const qs = new URLSearchParams();
        qs.set('include', 'properties');
        const opts = params.opts;
        if (opts.targetTypeGuid) qs.set('type', opts.targetTypeGuid);
        if (opts.depth !== undefined) qs.set('depth', String(opts.depth));
        if (opts.limit !== undefined) qs.set('limit', String(opts.limit));
        if (opts.cursor) qs.set('cursor', opts.cursor);
        return this.http.get<ChildrenWithPropertiesResponse>(
          `/api/pages/${params.parentGuid}/children?${qs.toString()}`,
        );
      },
    });
  }

  /**
   * Search resource. Re-keys on the (trimmed) query string itself and depends
   * on NO invalidation tag — no mutation needs to invalidate a search.
   */
  pageSearchResource(query: Signal<string | null>) {
    return rxResource({
      params: () => ({ q: query()?.trim() ?? '' }),
      stream: ({ params }) => {
        if (!params.q) throw new Error('pageSearchResource: empty query');
        return this.http
          .get<PageSearchResponse>(
            `/api/pages/search?q=${encodeURIComponent(params.q)}&limit=10`,
          )
          .pipe(map((r) => r.results ?? []));
      },
    });
  }

  /**
   * Resolve a single `[[wiki link]]` target (a page title or a raw guid) to a
   * concrete page via `POST /api/pages/links/resolve`. Used by the preview to
   * turn `[[…]]` into a `/pages/<guid>` href and to flag broken links.
   *
   * Read-only: bumps no invalidation tag. Callers cache per render pass.
   */
  async resolveLink(query: string): Promise<WikiLinkResolution> {
    const res = await firstValueFrom(
      this.http.post<LinkResolveResponse>('/api/pages/links/resolve', {
        query,
        maxResults: 1,
      }),
    );
    const match = res.matches?.[0];
    // Existence is derived from `exactMatch` — a fuzzy / substring-only hit must
    // still render broken and offer "create" ("never a bare title"). The
    // server's own `res.exists` is intentionally not used here.
    const exists = res.exactMatch === true && !!match;
    // Only trust the resolved guid on an exact match; for a miss the target is
    // echoed back (the broken link's href is never navigated to anyway).
    return { guid: exists ? match.guid : query, exists };
  }

  // ---- mutations ----

  async createPage(body: CreatePageRequest): Promise<PageContent> {
    const result = await firstValueFrom(this.http.post<PageContent>('/api/pages', body));
    this.bus.bumpMany([childrenTag(body.parentGuid), childrenAnyTag(), backlinksAnyTag()]);
    return result;
  }

  /**
   * Imperative children fetch — used by mutations that need a current list
   * without spinning up an `rxResource` (e.g. context-menu "sort children").
   */
  async fetchChildren(parentGuid: string | null): Promise<PageSummary[]> {
    const path = parentGuid ? `/api/pages/${parentGuid}/children` : '/api/pages/root/children';
    const response = await firstValueFrom(this.http.get<ChildrenResponse>(path));
    return response.children ?? [];
  }

  /**
   * Invalidation is derived from which keys the request body carries (it only
   * sends changed fields):
   * - `page:<guid>` always.
   * - `children:<result.folderId>` AND the coarse `children:any` when ANY tree-
   *   or board-visible field (`title` / `status` / `pageType` / `properties` /
   *   `boardOrder`) is present — `PageContent.folderId` is the owning parent
   *   guid, and a deep board aggregates descendants of some *other* parent and
   *   renders their titles/state, so it must refresh on a descendant card's
   *   title/status/pageType edit just as on a property/order edit.
   * - `ancestors:any` additionally when `title` is in the body — a folder
   *   rename changes the ancestor chain shown in every descendant's breadcrumb
   *   (precise per-descendant invalidation is not available at this layer).
   * - `backlinks:any` additionally when `content` is in the body — a body edit
   *   changes the link-graph edges into the pages it links to (precise
   *   per-target invalidation would need a link resolver we lack here).
   */
  async updatePage(guid: string, body: UpdatePageRequest): Promise<PageContent> {
    const result = await firstValueFrom(this.http.put<PageContent>(`/api/pages/${guid}`, body));
    const tags = [pageTag(guid)];
    const treeVisible = 'title' in body || 'status' in body || 'pageType' in body;
    const boardVisible = 'properties' in body || 'boardOrder' in body;
    if (treeVisible || boardVisible) tags.push(childrenTag(result.folderId), childrenAnyTag());
    if ('title' in body) tags.push(ancestorsAnyTag());
    if ('content' in body) tags.push(backlinksAnyTag());
    this.bus.bumpMany(tags);
    return result;
  }

  /**
   * The page's previous/owning parent is neither returned nor passed, so this
   * bumps the coarse `children:any` (covered by every children resource)
   * rather than widening the signature. It also bumps the precise
   * `children:<newParentGuid>`, the moved page's `ancestors:<guid>`, the coarse
   * `ancestors:any` (the move re-parents the page, changing the ancestor chain
   * of every descendant's breadcrumb), and its own `page:<guid>` (the move
   * changes the page's `folderId`).
   */
  async movePage(guid: string, body: MovePageRequest): Promise<void> {
    await firstValueFrom(this.http.put<void>(`/api/pages/${guid}/move`, body));
    this.bus.bumpMany([
      childrenAnyTag(),
      ancestorsTag(guid),
      ancestorsAnyTag(),
      childrenTag(body.newParentGuid),
      pageTag(guid),
    ]);
  }

  async reorderPages(body: ReorderRequest): Promise<{ updated: number }> {
    const result = await firstValueFrom(
      this.http.put<{ updated: number }>('/api/pages/reorder', body),
    );
    this.bus.bumpMany([childrenTag(body.parentGuid), childrenAnyTag()]);
    return result;
  }

  /**
   * The deleted page's parent is not known at the call site, so this bumps the
   * coarse `children:any` plus the page's own `page:<guid>`. It also bumps
   * `backlinks:any` — removing a page drops the link-graph edges it owned.
   */
  async deletePage(guid: string, body: DeletePageRequest = {}): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`/api/pages/${guid}`, { body }));
    this.bus.bumpMany([childrenAnyTag(), pageTag(guid), backlinksAnyTag()]);
  }
}
