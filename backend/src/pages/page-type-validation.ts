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
 * Validate that a new child page's type is allowed by the parent's type constraints.
 * If the parent has no type, anything is allowed (standard wiki behaviour).
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

  if (!parentPage.pageType) {
    // Untyped parent — no constraints
    return { valid: true, warnings: [] };
  }

  const parentType = await getPageType(parentPage.pageType);
  if (!parentType) {
    // Parent type was deleted — no constraints
    return { valid: true, warnings: [] };
  }

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

  return { valid: warnings.length === 0, warnings };
}
