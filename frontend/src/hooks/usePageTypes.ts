import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../config/api';
import { PageTypeDefinition, PageTypeProperty } from '../types/page';

// ============================================================================
// Queries
// ============================================================================

export const usePageTypes = () => {
  return useQuery({
    queryKey: ['pageTypes'],
    queryFn: async (): Promise<PageTypeDefinition[]> => {
      const response = await apiClient.get('/page-types');
      return response.data.pageTypes || [];
    },
    staleTime: 300_000,
  });
};

export const usePageType = (guid: string | undefined) => {
  return useQuery({
    queryKey: ['pageTypes', guid],
    queryFn: async (): Promise<PageTypeDefinition> => {
      const response = await apiClient.get(`/page-types/${guid}`);
      return response.data;
    },
    enabled: !!guid,
  });
};

export const useAllowedChildTypes = (parentTypeGuid: string | undefined) => {
  return useQuery({
    queryKey: ['pageTypes', parentTypeGuid, 'allowed-children'],
    queryFn: async (): Promise<{
      allowedChildTypes: PageTypeDefinition[];
      allowWikiPageChildren: boolean;
    }> => {
      const response = await apiClient.get(`/page-types/${parentTypeGuid}/allowed-children`);
      return response.data;
    },
    enabled: !!parentTypeGuid,
  });
};

// ============================================================================
// Mutations
// ============================================================================

export interface CreatePageTypeRequest {
  name: string;
  icon: string;
  properties?: PageTypeProperty[];
  allowedChildTypes?: string[];
  allowWikiPageChildren?: boolean;
}

export interface UpdatePageTypeRequest {
  name?: string;
  icon?: string;
  properties?: PageTypeProperty[];
  allowedChildTypes?: string[];
  allowWikiPageChildren?: boolean;
}

export const useCreatePageType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePageTypeRequest): Promise<PageTypeDefinition> => {
      const response = await apiClient.post('/page-types', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pageTypes'] });
    },
  });
};

export const useUpdatePageType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ guid, ...data }: UpdatePageTypeRequest & { guid: string }): Promise<PageTypeDefinition> => {
      const response = await apiClient.put(`/page-types/${guid}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pageTypes'] });
      queryClient.invalidateQueries({ queryKey: ['pageTypes', variables.guid] });
    },
  });
};

export const useDeletePageType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (guid: string): Promise<void> => {
      await apiClient.delete(`/page-types/${guid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pageTypes'] });
    },
  });
};
