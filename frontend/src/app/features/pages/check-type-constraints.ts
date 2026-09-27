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

/**
 * Type-constraint check for a **sibling** drop — a `before` / `after` tree drop,
 * where the dragged page joins the target row's parent rather than becoming the
 * target row's child.
 *
 * `parentPageType` is the page-type guid of that parent (`null` for the tree root
 * or an untyped parent). `checkTypeConstraints` only ever reads `.pageType` off
 * its target, so the parent is modelled by spreading that type onto the dragged
 * page — no extra fetch, and no second copy of the rule.
 *
 * Shared by every place that asks this question: the row's
 * `cdkDropListEnterPredicate` and its `.drop-invalid` hover warning
 * (`page-tree-item`), the cross-parent on-drop re-check (`pages-view.onTreeDrop`)
 * and the reparent-to-root drop (`page-tree.onRootDrop`).
 */
export function checkSiblingDropAllowed(
  draggedPage: PageSummary,
  parentPageType: string | null,
  pageTypesMap: Record<string, PageTypeDefinition>,
): string[] {
  return checkTypeConstraints(
    draggedPage,
    { ...draggedPage, pageType: parentPageType ?? undefined },
    pageTypesMap,
  );
}
