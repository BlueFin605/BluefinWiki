import { HttpClient } from '@angular/common/http';
import { Injectable, type Signal, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import type {
  PageContent,
  PageSummary,
  UpdatePageRequest,
  MovePageRequest,
  ReorderRequest,
  DeletePageRequest,
} from './page.types';

interface ChildrenResponse { children: PageSummary[] }
interface AncestorsResponse { ancestors: PageSummary[] }

@Injectable({ providedIn: 'root' })
export class Pages {
  private readonly http = inject(HttpClient);
  private readonly _version = signal(0);

  bumpVersion(): void {
    this._version.update((v) => v + 1);
  }

  /**
   * Reactive children resource. `parentGuid` is a signal so consumers can
   * switch the request without recreating the resource. Pass `null` for the
   * root level (the React app's `/pages/root/children` endpoint).
   *
   * The resource also depends on `_version` so any successful mutation that
   * calls `bumpVersion()` triggers a refetch.
   */
  childrenResource(parentGuid: Signal<string | null>) {
    return rxResource({
      params: () => ({ parentGuid: parentGuid(), v: this._version() }),
      stream: ({ params }) => {
        const path = params.parentGuid
          ? `/api/pages/${params.parentGuid}/children`
          : '/api/pages/root/children';
        return this.http
          .get<ChildrenResponse>(path)
          .pipe(map((r) => r.children ?? []));
      },
    });
  }

  /**
   * Reactive page-content resource. Pass `null` to disable the fetch (the
   * resource value stays undefined). Bumps when `_version` bumps.
   */
  pageResource(guid: Signal<string | null>) {
    return rxResource({
      params: () => ({ guid: guid(), v: this._version() }),
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

  ancestorsResource(guid: Signal<string | null>) {
    return rxResource({
      params: () => ({ guid: guid(), v: this._version() }),
      stream: ({ params }) => {
        if (!params.guid) throw new Error('ancestorsResource called with null guid');
        return this.http
          .get<AncestorsResponse>(`/api/pages/${params.guid}/ancestors`)
          .pipe(map((r) => r.ancestors ?? []));
      },
    });
  }

  // ---- mutations ----

  async updatePage(guid: string, body: UpdatePageRequest): Promise<PageContent> {
    const result = await firstValueFrom(this.http.put<PageContent>(`/api/pages/${guid}`, body));
    this.bumpVersion();
    return result;
  }

  async movePage(guid: string, body: MovePageRequest): Promise<void> {
    await firstValueFrom(this.http.put<void>(`/api/pages/${guid}/move`, body));
    this.bumpVersion();
  }

  async reorderPages(body: ReorderRequest): Promise<{ updated: number }> {
    const result = await firstValueFrom(
      this.http.put<{ updated: number }>('/api/pages/reorder', body),
    );
    this.bumpVersion();
    return result;
  }

  async deletePage(guid: string, body: DeletePageRequest = {}): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`/api/pages/${guid}`, { body }));
    this.bumpVersion();
  }
}
