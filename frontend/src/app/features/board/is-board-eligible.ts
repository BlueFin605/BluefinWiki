import type { BoardConfig, PageChildDetail, PageTypeDefinition } from '../pages/page.types';

/** Minimal shape {@link isBoardEligible} needs from the page under view. */
export interface BoardEligibilityPage {
  boardConfig?: BoardConfig | null;
}

/**
 * React parity (step 5.1): a page is board-eligible when its
 * `boardConfig.targetTypeGuid` is explicitly set, **or** at least one direct
 * child's page type defines a `state` property and that child carries a
 * non-empty value for it. The latter lets a page become board-eligible the
 * moment a state-bearing child appears, without the owner first opening
 * Board Settings to pick a target type.
 *
 * Pure and side-effect free: callers own fetching `children` (direct
 * children only — the config-less path never recurses into descendants) and
 * `pageTypesMap` (page-type definitions keyed by guid).
 */
export function isBoardEligible(
  page: BoardEligibilityPage | null | undefined,
  children: readonly PageChildDetail[],
  pageTypesMap: Record<string, PageTypeDefinition>,
): boolean {
  if (page?.boardConfig?.targetTypeGuid) return true;
  return children.some((child) => childHasStateValue(child, pageTypesMap));
}

/** True when `child`'s page type defines a `state` property and `child` has a non-empty value for it. */
function childHasStateValue(
  child: PageChildDetail,
  pageTypesMap: Record<string, PageTypeDefinition>,
): boolean {
  if (!child.pageType) return false;
  const type = pageTypesMap[child.pageType];
  if (!type?.properties.some((p) => p.name === 'state')) return false;
  const value = child.properties?.['state']?.value;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}
