import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../config/api';

export interface TagRecord {
  tag: string;
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<TagRecord[]> => {
      const response = await apiClient.get('/tags');
      return response.data.tags || [];
    },
    staleTime: 60_000, // Tags change infrequently
  });
};
