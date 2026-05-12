/**
 * Search Service
 *
 * Thin HTTP client over the backend's GET /search endpoint, which performs
 * semantic search via Bedrock embeddings + S3 Vectors.
 */

import { apiClient } from '../config/api';
import type {
  WikiSearchQuery,
  WikiSearchResultSet,
} from '../types/search';

const SEARCH_PATH = '/search';
const MAX_QUERY_LENGTH = 500;

export class ClientSearchService {
  private path: string;

  constructor(path?: string) {
    this.path = path || SEARCH_PATH;
  }

  async search(query: WikiSearchQuery): Promise<WikiSearchResultSet> {
    const sanitized = query.text
      .slice(0, MAX_QUERY_LENGTH)
      .replace(/[<>]/g, '')
      .trim();

    if (!sanitized) {
      return { results: [], totalResults: 0, executionTimeMs: 0 };
    }

    try {
      const response = await apiClient.get<WikiSearchResultSet>(this.path, {
        params: {
          q: sanitized,
          scope: query.scope,
          limit: query.limit,
          offset: query.offset,
        },
      });
      return response.data;
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status) {
        throw new Error(`Search failed: ${status}`);
      }
      throw error;
    }
  }
}
