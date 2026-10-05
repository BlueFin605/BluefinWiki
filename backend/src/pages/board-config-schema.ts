import { z } from 'zod';

export const KEY_PREFIX_REGEX = /^[A-Z][A-Z0-9]{1,9}$/;

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
  keyPrefix: z.string().regex(KEY_PREFIX_REGEX, 'Prefix must be 2-10 upper-case letters/digits, starting with a letter').optional(),
});

/** Page-type defaults: keyPrefix is page-only, so it is stripped here. */
export const PageTypeBoardDefaultsSchema = BoardConfigObjectSchema.omit({ keyPrefix: true });

/** As accepted on a page update: null removes the page's boardConfig. */
export const BoardConfigSchema = BoardConfigObjectSchema.nullable().optional();
