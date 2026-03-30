import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../config/api';

export interface TagRecord {
  scope: string;
  tag: string;
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

/** Scope used for page-level tags (the top-level `tags` field in frontmatter) */
export const PAGE_TAGS_SCOPE = '_page';

/**
 * Fetch tags for a given scope (property name or "_page" for page-level tags).
 * Results are cached for 5 minutes to reduce API calls.
 */
export const useTags = (scope: string = PAGE_TAGS_SCOPE) => {
  return useQuery({
    queryKey: ['tags', scope],
    queryFn: async (): Promise<TagRecord[]> => {
      const response = await apiClient.get('/tags', { params: { scope } });
      return response.data.tags || [];
    },
    staleTime: 300_000, // 5 minutes — tags change infrequently
  });
};
