/**
 * Unit Tests for ClientSearchService (HTTP wrapper)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientSearchService } from '../ClientSearchService';
import { apiClient } from '../../config/api';
import type { WikiSearchQuery, WikiSearchResultSet } from '../../types/search';

vi.mock('../../config/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);

const baseQuery: WikiSearchQuery = {
  text: 'recipe',
  scope: 'all',
  limit: 10,
  offset: 0,
};

const sampleResponse: WikiSearchResultSet = {
  results: [
    {
      pageId: 'page-1',
      title: 'Family Recipes',
      snippet: 'pasta and pizza recipes',
      relevanceScore: 950,
      matchCount: 0,
      path: 'Cooking > Family Recipes',
      tags: ['recipe'],
    },
  ],
  totalResults: 1,
  executionTimeMs: 12,
};

describe('ClientSearchService', () => {
  let service: ClientSearchService;

  beforeEach(() => {
    mockGet.mockReset();
    service = new ClientSearchService();
  });

  it('returns the backend result set', async () => {
    mockGet.mockResolvedValue({ data: sampleResponse });

    const result = await service.search(baseQuery);

    expect(result).toEqual(sampleResponse);
    expect(mockGet).toHaveBeenCalledWith('/search', {
      params: { q: 'recipe', scope: 'all', limit: 10, offset: 0 },
    });
  });

  it('uses a custom path when provided', async () => {
    mockGet.mockResolvedValue({ data: sampleResponse });
    const custom = new ClientSearchService('/test-search');

    await custom.search(baseQuery);

    expect(mockGet).toHaveBeenCalledWith('/test-search', expect.any(Object));
  });

  it('returns an empty result set without calling the API for an empty query', async () => {
    const result = await service.search({ ...baseQuery, text: '' });

    expect(result).toEqual({ results: [], totalResults: 0, executionTimeMs: 0 });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('strips angle brackets from the query before sending', async () => {
    mockGet.mockResolvedValue({ data: sampleResponse });

    await service.search({ ...baseQuery, text: '<script>alert(1)</script>recipe' });

    expect(mockGet).toHaveBeenCalledWith('/search', {
      params: expect.objectContaining({ q: 'scriptalert(1)/scriptrecipe' }),
    });
  });

  it('truncates queries longer than 500 chars', async () => {
    mockGet.mockResolvedValue({ data: sampleResponse });
    const longText = 'a'.repeat(1000);

    await service.search({ ...baseQuery, text: longText });

    const call = mockGet.mock.calls[0]?.[1] as { params: { q: string } } | undefined;
    expect(call?.params.q.length).toBe(500);
  });

  it('returns empty results when the sanitized query is empty', async () => {
    const result = await service.search({ ...baseQuery, text: '<<<>>>' });

    expect(result).toEqual({ results: [], totalResults: 0, executionTimeMs: 0 });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('throws a status-coded error when the request fails', async () => {
    mockGet.mockRejectedValue({ response: { status: 503 } });

    await expect(service.search(baseQuery)).rejects.toThrow('Search failed: 503');
  });

  it('rethrows non-HTTP errors', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    await expect(service.search(baseQuery)).rejects.toThrow('Network error');
  });
});
