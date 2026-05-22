import type { PageSummary, PageTypeDefinition } from './page.types';

/**
 * Returns an array of human-readable rejection reasons. Empty array means
 * the drop is allowed. Mirrors React's `checkTypeConstraints` in
 * `BluefinWiki/frontend/src/components/pages/PageTreeItem.tsx`.
 */
export function checkTypeConstraints(
  draggedPage: PageSummary,
  targetPage: PageSummary,
  pageTypesMap: Record<string, PageTypeDefinition>,
): string[] {
  const warnings: string[] = [];
  const parentType = targetPage.pageType ? pageTypesMap[targetPage.pageType] : null;
  const childType = draggedPage.pageType ? pageTypesMap[draggedPage.pageType] : null;

  // Parent's perspective — does the parent allow this child type?
  if (parentType) {
    if (draggedPage.pageType) {
      if (
        parentType.allowedChildTypes.length > 0 &&
        !parentType.allowedChildTypes.includes(draggedPage.pageType)
      ) {
        warnings.push(
          `${parentType.name} does not allow ${childType?.name ?? 'this type'} as a child`,
        );
      }
    } else if (!parentType.allowWikiPageChildren) {
      warnings.push(`${parentType.name} does not allow untyped wiki pages as children`);
    }
  }

  // Child's perspective — does the child allow this parent type?
  if (childType && childType.allowedParentTypes.length > 0) {
    if (targetPage.pageType) {
      if (!childType.allowedParentTypes.includes(targetPage.pageType)) {
        warnings.push(
          `${childType.name} cannot be placed under ${parentType?.name ?? 'this type'}`,
        );
      }
    } else if (!childType.allowAnyParent) {
      warnings.push(`${childType.name} cannot be placed under an untyped wiki page`);
    }
  }

  return warnings;
}
