/**
 * AiTools — the two endpoints the AI auto fetch-tool loop dispatches to.
 * Ports `apiClient.post('/fetch-url', ...)` and
 * `apiClient.get('/imdb/show-details', ...)` from React's `useAi.ts`.
 *
 * These are auto-executed by `Ai.sendMessage`'s fetch loop (step 7.2) — there
 * is no Apply/Discard for `fetch_url` / `fetch_imdb_show`, unlike the
 * create/update/delete/move actions `AiActionRunner` dispatches.
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface FetchUrlResult {
  url: string;
  title?: string;
  text: string;
  contentType: string;
  truncated: boolean;
}

export interface ImdbShowDetailsResult {
  query?: string;
  imdbId: string;
  title: string;
  synopsis: string;
  seasons?: number;
  rating?: number;
  votes?: number;
  url: string;
}

export interface ImdbShowDetailsParams {
  query?: string;
  imdbId?: string;
}

@Injectable({ providedIn: 'root' })
export class AiTools {
  private readonly http = inject(HttpClient);

  fetchUrl(url: string): Promise<FetchUrlResult> {
    return firstValueFrom(
      this.http.post<FetchUrlResult>('/api/fetch-url', { url }),
    );
  }

  fetchImdbShow(params: ImdbShowDetailsParams): Promise<ImdbShowDetailsResult> {
    let httpParams = new HttpParams();
    if (params.query) httpParams = httpParams.set('query', params.query);
    if (params.imdbId) httpParams = httpParams.set('imdbId', params.imdbId);
    return firstValueFrom(
      this.http.get<ImdbShowDetailsResult>('/api/imdb/show-details', {
        params: httpParams,
      }),
    );
  }
}
