/**
 * Search service — thin HttpClient wrapper over the backend's GET /api/search
 * endpoint, which runs semantic search via Bedrock embeddings + S3 Vectors.
 *
 * Ports `frontend/src/services/ClientSearchService.ts` byte-for-byte:
 * sanitise input (slice to 500, strip <>, trim) and surface HTTP status codes
 * as readable error messages.
 */

import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RateLimiter } from './rate-limiter';
import type { WikiSearchQuery, WikiSearchResult, WikiSearchResultSet } from './search.types';

const SEARCH_PATH = '/api/search';
const MAX_QUERY_LENGTH = 500;

// Client-side mirror of the React app's limiter (§3.6): at most 60 dispatched
// search requests in any rolling 60s window.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Thrown by {@link Search.search} when the client-side rate limiter
 * suppresses a dispatch. Callers that want to leave existing UI state alone
 * (rather than surfacing a generic error) should catch this specifically —
 * `Search.rateLimited` is the signal driving the user-facing message.
 */
export class RateLimitExceededError extends Error {
  constructor() {
    super('Too many searches. Please wait a moment.');
    this.name = 'RateLimitExceededError';
  }
}

/**
 * True when a search response's already-loaded results don't yet cover the
 * backend's reported total — i.e. there's another page to fetch.
 *
 * The backend (`backend/src/search/search-query.ts`) is offset+total paging,
 * not cursor-based: it slices a ranked hit list by `offset`/`limit` and
 * always returns the *grand* `totalResults` for the (unpaged) match set. So
 * "more available" is derivable from what's already on the wire — no
 * separate `hasMore`/`nextCursor` field from the backend is needed. Pass the
 * accumulated result set (i.e. `results.length` is how many have been loaded
 * so far across all pages), not a single page's response.
 */
export function hasMoreResults(resultSet: {
  results: readonly WikiSearchResult[];
  totalResults: WikiSearchResultSet['totalResults'];
}): boolean {
  return resultSet.results.length < resultSet.totalResults;
}

@Injectable({ providedIn: 'root' })
export class Search {
  private readonly http = inject(HttpClient);
  private readonly limiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  /**
   * True while the client-side rate limiter is suppressing dispatched
   * requests. `SearchDialog` reads this directly to show/hide the "Too many
   * searches" message. Cleared as soon as a subsequent dispatch has capacity
   * again (not on a timer — the limiter only counts actual dispatches, per
   * step 6.3's brief).
   */
  readonly rateLimited = signal(false);

  async search(query: WikiSearchQuery): Promise<WikiSearchResultSet> {
    const sanitized = query.text
      .slice(0, MAX_QUERY_LENGTH)
      .replace(/[<>]/g, '')
      .trim();

    if (!sanitized) {
      return { results: [], totalResults: 0, executionTimeMs: 0 };
    }

    // Gate here — the single choke point both the debounced query pipeline
    // and the imperative "Load more" fetch dispatch through — so both share
    // one combined 60/min budget.
    if (!this.limiter.tryAcquire(Date.now())) {
      this.rateLimited.set(true);
      throw new RateLimitExceededError();
    }
    this.rateLimited.set(false);

    const params = new HttpParams()
      .set('q', sanitized)
      .set('scope', query.scope)
      .set('limit', String(query.limit))
      .set('offset', String(query.offset));

    try {
      return await firstValueFrom(
        this.http.get<WikiSearchResultSet>(SEARCH_PATH, { params }),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status) {
        throw new Error(`Search failed: ${error.status}`, { cause: error });
      }
      throw error;
    }
  }
}
