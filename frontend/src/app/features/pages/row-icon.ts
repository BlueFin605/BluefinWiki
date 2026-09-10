import type { PageSummary, PageTypeDefinition } from './page.types';

/** Untyped page that has children — a yellow folder (matches React). */
export const FOLDER_ICON = '📁';
/** Untyped leaf page — a grey document (matches React). */
export const DOCUMENT_ICON = '📄';

/**
 * Pure, DOM-free tree-row icon rule (step 2.4). Priority, matching React:
 *
 *  1. The page has a `pageType` present in `map` whose entry has a non-empty
 *     `icon` → that emoji.
 *  2. Else the page `hasChildren` → folder (`📁`).
 *  3. Else → document (`📄`).
 *
 * `map` is the page-types map fed from `PageTypes` (step 1.1). An unknown
 * `pageType`, or a matched type with a blank `icon`, falls through to the
 * folder/document rule.
 */
export function rowIcon(
  summary: Pick<PageSummary, 'pageType' | 'hasChildren'>,
  map: Record<string, PageTypeDefinition>,
): string {
  const type = summary.pageType;
  const typeIcon = type ? map[type]?.icon : undefined;
  if (typeIcon) return typeIcon;
  return summary.hasChildren ? FOLDER_ICON : DOCUMENT_ICON;
}
