/**
 * React Query hooks for page operations
 * Simple implementation without caching logic
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../config/api';
import {
  PageContent,
  PageSummary,
  PageChildDetail,
  CreatePageRequest,
  UpdatePageRequest,
  MovePageRequest,
} from '../types/page';

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
    queryKey: ['pages', 'children', parentGuid],
    queryFn: async (): Promise<PageSummary[]> => {
      const path = parentGuid ? `/pages/${parentGuid}/children` : '/pages/root/children';
      const response = await apiClient.get(path);
      return response.data.children || [];
    },
  });
};

/**
 * Fetch children with pageType and properties included (for board view)
 */
export const usePageChildrenWithProperties = (parentGuid: string | null) => {
  return useQuery({
    queryKey: ['pages', 'children', parentGuid, 'with-properties'],
    queryFn: async (): Promise<PageChildDetail[]> => {
      if (!parentGuid) return [];
      const response = await apiClient.get(`/pages/${parentGuid}/children?include=properties`);
      return response.data.children || [];
    },
    enabled: !!parentGuid,
  });
};

/**
 * Fetch a single page by GUID
 */
export const usePageDetail = (guid: string) => {
  return useQuery({
    queryKey: ['pages', 'detail', guid],
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
    queryKey: ['pages', 'ancestors', guid],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', 'children'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', 'detail', guid] });
      queryClient.invalidateQueries({ queryKey: ['pages', 'children'] });
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
      queryClient.invalidateQueries({ queryKey: ['pages', 'children'] });
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
      queryClient.invalidateQueries({ queryKey: ['pages', 'children'] });
    },
  });
};

/**
 * Search pages by title (for link autocomplete)
 */
export const usePageSearch = (query: string, options?: { enabled?: boolean; limit?: number }) => {
  return useQuery({
    queryKey: ['pages', 'search', query],
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
  });
};

/**
 * Fetch backlinks for a page (pages that link to this page)
 */
export const useBacklinks = (guid: string) => {
  return useQuery({
    queryKey: ['pages', 'backlinks', guid],
    queryFn: async (): Promise<BacklinksResponse> => {
      const response = await apiClient.get(`/pages/${guid}/backlinks`);
      return response.data;
    },
    enabled: !!guid,
  });
};
