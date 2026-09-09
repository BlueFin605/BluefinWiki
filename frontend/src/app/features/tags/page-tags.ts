import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { InvalidationBus, pageTagsListTag } from '../../core/api/invalidation';

/** Scope the backend uses for page-level tags (the frontmatter `tags` field). */
export const PAGE_TAGS_SCOPE = '_page';

/** One row of the shared tag vocabulary (`GET /tags`). */
export interface TagRecord {
  scope: string;
  tag: string;
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

interface TagsListResponse {
  tags: TagRecord[];
  scope: string;
}

/**
 * Read access to the shared tag vocabulary (`GET /tags?scope=…`). Mirrors
 * {@link PageTypes} — a single reactive `rxResource` keyed on an invalidation
 * tag. The page-level vocabulary drives the Tags inspector autocomplete
 * (step 4.5); property-scoped vocabularies (step 4.7) reuse {@link vocabResource}.
 */
@Injectable({ providedIn: 'root' })
export class PageTags {
  private readonly http = inject(HttpClient);
  private readonly bus = inject(InvalidationBus);

  /**
   * The page-level tag vocabulary (`scope=_page`), sorted by the backend.
   * Keys on `page-tags:list`.
   */
  pageTagsResource() {
    return this.vocabResource(PAGE_TAGS_SCOPE);
  }

  /**
   * The tag vocabulary for an arbitrary scope (`_page`, or a custom-property
   * name for step 4.7). Keys on `page-tags:list` — a coarse tag shared across
   * scopes; a write to any scope's vocabulary refetches all of them, which is
   * acceptable for a small autocomplete list.
   */
  vocabResource(scope: string) {
    return rxResource({
      params: () => ({ scope, v: this.bus.version(pageTagsListTag()) }),
      stream: ({ params }) =>
        this.http
          .get<TagsListResponse>('/api/tags', { params: { scope: params.scope } })
          .pipe(map((r) => (r?.tags ?? []).map((t) => t.tag))),
    });
  }
}
