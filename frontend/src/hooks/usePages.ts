/**
 * React Query hooks for page operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../config/api';
import {
  PageContent,
  PageSummary,
  CreatePageRequest,
  UpdatePageRequest,
  MovePageRequest,
} from '../types/page';

// Query keys
export const pageKeys = {
  all: ['pages'] as const,
  children: (parentGuid: string | null) => [...pageKeys.all, 'children', parentGuid] as const,
  detail: (guid: string) => [...pageKeys.all, 'detail', guid] as const,
  ancestors: (guid: string) => [...pageKeys.all, 'ancestors', guid] as const,
  search: (query: string) => [...pageKeys.all, 'search', query] as const,
  backlinks: (guid: string) => [...pageKeys.all, 'backlinks', guid] as const,
};

/**
 * Search result for link autocomplete
 */
export interface PageSearchResult {
  guid: string;
  title: string;
  path: string;
  folderId: string | null;
}

/**
 * Backlink information for a page
 */
export interface Backlink {
  guid: string;
  title: string;
  linkText?: string;
  createdAt: string;
}

/**
 * Backlinks response
 */
export interface BacklinksResponse {
  guid: string;
  backlinks: Backlink[];
  count: number;
}

/**
 * Fetch children of a parent page (or root pages if parentGuid is null)
 */
export const usePageChildren = (parentGuid: string | null) => {
  return useQuery({
    queryKey: pageKeys.children(parentGuid),
    queryFn: async (): Promise<PageSummary[]> => {
      const path = parentGuid ? `/pages/${parentGuid}/children` : '/pages/children';
      const response = await apiClient.get(path);
      return response.data.children || [];
    },
  });
};

/**
 * Fetch a single page by GUID
 */
export const usePageDetail = (guid: string) => {
  return useQuery({
    queryKey: pageKeys.detail(guid),
    queryFn: async (): Promise<PageContent> => {
      const response = await apiClient.get(`/pages/${guid}`);
      return response.data;
    },
    enabled: !!guid,
  });
};

/**
 * Fetch ancestors of a page (for breadcrumbs)
 */
export const usePageAncestors = (guid: string) => {
  return useQuery({
    queryKey: pageKeys.ancestors(guid),
    queryFn: async (): Promise<PageSummary[]> => {
      const response = await apiClient.get(`/pages/${guid}/ancestors`);
      return response.data.ancestors || [];
    },
    enabled: !!guid,
  });
};

/**
 * Create a new page
 */
export const useCreatePage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreatePageRequest): Promise<PageContent> => {
      const response = await apiClient.post('/pages', request);
      return response.data;
    },
    onSuccess: (newPage) => {
      // Invalidate children list for the parent
      queryClient.invalidateQueries({
        queryKey: pageKeys.children(newPage.folderId || null),
      });
      // Invalidate all children queries to refresh tree
      queryClient.invalidateQueries({
        queryKey: pageKeys.all,
      });
    },
  });
};

/**
 * Update a page
 */
export const useUpdatePage = (guid: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdatePageRequest): Promise<PageContent> => {
      const response = await apiClient.put(`/pages/${guid}`, request);
      return response.data;
    },
    onSuccess: (updatedPage) => {
      // Invalidate the page detail cache to ensure fresh data is fetched
      // This is necessary because the backend returns minimal response data,
      // so we can't reliably update the cache with partial information
      queryClient.invalidateQueries({
        queryKey: pageKeys.detail(guid),
      });
      
      // Invalidate parent's children list
      if (updatedPage.folderId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: pageKeys.children(updatedPage.folderId || null),
        });
      }
    },
  });
};

/**
 * Move a page to a new parent
 */
export const useMovePage = (guid: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: MovePageRequest): Promise<void> => {
      await apiClient.post(`/pages/${guid}/move`, request);
    },
    onSuccess: () => {
      // Invalidate all children queries to refresh entire tree
      queryClient.invalidateQueries({
        queryKey: pageKeys.all,
      });
    },
  });
};

/**
 * Delete a page
 */
export const useDeletePage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      guid,
      recursive,
    }: {
      guid: string;
      recursive?: boolean;
    }): Promise<void> => {
      await apiClient.delete(`/pages/${guid}`, {
        data: { recursive },
      });
    },
    onSuccess: () => {
      // Invalidate all children queries to refresh entire tree
      queryClient.invalidateQueries({
        queryKey: pageKeys.all,
      });
    },
  });
};

/**
 * Search pages by title (for link autocomplete)
 */
export const usePageSearch = (query: string, options?: { enabled?: boolean; limit?: number }) => {
  return useQuery({
    queryKey: pageKeys.search(query),
    queryFn: async (): Promise<PageSearchResult[]> => {
      if (!query || query.trim() === '') {
        return [];
      }
      
      const params = new URLSearchParams({ q: query });
      if (options?.limit) {
        params.append('limit', options.limit.toString());
      }
      
      const response = await apiClient.get(`/pages/search?${params.toString()}`);
      return response.data.results || [];
    },
    enabled: options?.enabled !== false && !!query && query.trim() !== '',
    staleTime: 30000, // Cache for 30 seconds
  });
};

/**
 * Fetch backlinks for a page (pages that link to this page)
 */
export const useBacklinks = (guid: string) => {
  return useQuery({
    queryKey: pageKeys.backlinks(guid),
    queryFn: async (): Promise<BacklinksResponse> => {
      const response = await apiClient.get(`/pages/${guid}/backlinks`);
      return response.data;
    },
    enabled: !!guid,
    staleTime: 60000, // Cache for 1 minute
  });
};
