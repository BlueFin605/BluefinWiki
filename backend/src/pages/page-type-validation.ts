/**
 * Page Type Validation
 *
 * Advisory validation for page type constraints.
 * In MVP, warnings are logged but don't hard-block saves.
 */

import { PageProperty } from '../types/index.js';
import { getPageType } from '../page-types/page-types-service.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validate that a page's properties satisfy its type's required properties schema.
 * Returns warnings for missing required properties or type mismatches.
 * If the type definition is not found (deleted type), validation passes.
 */
export async function validatePageType(
  pageTypeGuid: string,
  properties: Record<string, PageProperty>
): Promise<ValidationResult> {
  const warnings: string[] = [];

  const typeDef = await getPageType(pageTypeGuid);
  if (!typeDef) {
    // Type was deleted — skip validation per error policy
    return { valid: true, warnings: [] };
  }

  for (const schemaProp of typeDef.properties) {
    const pageProp = properties[schemaProp.name];

    if (schemaProp.required && !pageProp) {
      warnings.push(`Required property '${schemaProp.name}' is missing (type: ${typeDef.name})`);
      continue;
    }

    if (pageProp && pageProp.type !== schemaProp.type) {
      warnings.push(
        `Property '${schemaProp.name}' has type '${pageProp.type}' but type '${typeDef.name}' expects '${schemaProp.type}'`
      );
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Validate that a child page's type is allowed by the parent's type constraints
 * AND that the parent's type is allowed by the child's type constraints.
 * Both checks must pass. Used for both creation and move (drag-drop reparent).
 * If neither page has a type, anything is allowed (standard wiki behaviour).
 */
export async function validateChildTypeConstraint(
  parentGuid: string,
  childPageTypeGuid: string | undefined
): Promise<ValidationResult> {
  const warnings: string[] = [];

  const storagePlugin = getStoragePlugin();
  let parentPage;
  try {
    parentPage = await storagePlugin.loadPage(parentGuid);
  } catch {
    // Parent not found — allow (shouldn't normally happen)
    return { valid: true, warnings: [] };
  }

  // CHECK 1: Parent's perspective — does the parent allow this child type?
  const parentType = parentPage.pageType ? await getPageType(parentPage.pageType) : null;

  if (parentType) {
    if (childPageTypeGuid) {
      // Typed child — check allowedChildTypes
      if (parentType.allowedChildTypes.length > 0 &&
          !parentType.allowedChildTypes.includes(childPageTypeGuid)) {
        warnings.push(
          `Page type is not in the allowed child types for parent type '${parentType.name}'`
        );
      }
    } else {
      // Untyped child — check allowWikiPageChildren
      if (!parentType.allowWikiPageChildren) {
        warnings.push(
          `Parent type '${parentType.name}' does not allow untyped wiki page children`
        );
      }
    }
  }

  // CHECK 2: Child's perspective — does the child allow this parent type?
  if (childPageTypeGuid) {
    const childType = await getPageType(childPageTypeGuid);
    if (childType && childType.allowedParentTypes.length > 0) {
      if (parentPage.pageType) {
        if (!childType.allowedParentTypes.includes(parentPage.pageType)) {
          warnings.push(
            `Type '${childType.name}' cannot be placed under parent type '${parentType?.name || 'unknown'}'`
          );
        }
      } else {
        // Untyped parent — check allowAnyParent
        if (!childType.allowAnyParent) {
          warnings.push(
            `Type '${childType.name}' cannot be placed under an untyped wiki page`
          );
        }
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}
