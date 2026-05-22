/**
 * Search service — thin HttpClient wrapper over the backend's GET /api/search
 * endpoint, which runs semantic search via Bedrock embeddings + S3 Vectors.
 *
 * Ports `frontend/src/services/ClientSearchService.ts` byte-for-byte:
 * sanitise input (slice to 500, strip <>, trim) and surface HTTP status codes
 * as readable error messages.
 */

import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { WikiSearchQuery, WikiSearchResultSet } from './search.types';

const SEARCH_PATH = '/api/search';
const MAX_QUERY_LENGTH = 500;

@Injectable({ providedIn: 'root' })
export class Search {
  private readonly http = inject(HttpClient);

  async search(query: WikiSearchQuery): Promise<WikiSearchResultSet> {
    const sanitized = query.text
      .slice(0, MAX_QUERY_LENGTH)
      .replace(/[<>]/g, '')
      .trim();

    if (!sanitized) {
      return { results: [], totalResults: 0, executionTimeMs: 0 };
    }

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
