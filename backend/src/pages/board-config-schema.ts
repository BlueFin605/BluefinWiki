import { z } from 'zod';

/** A page's (or a page type's default) Kanban board settings. */
export const BoardConfigObjectSchema = z.object({
  columns: z.array(z.string()).optional(),
  colors: z.record(z.string(), z.string()).optional(),
  targetTypeGuid: z.string().uuid().optional(),
  targetTypeGuids: z.array(z.string().uuid()).min(1).max(50).optional(),
  leafTypes: z.boolean().optional(),
  depth: z.number().min(1).max(10).optional(),
  showParentTitle: z.boolean().optional(),
  swapTitles: z.boolean().optional(),
  defaultView: z.enum(['content', 'board']).optional(),
});

/** As accepted on a page update: null removes the page's boardConfig. */
export const BoardConfigSchema = BoardConfigObjectSchema.nullable().optional();
