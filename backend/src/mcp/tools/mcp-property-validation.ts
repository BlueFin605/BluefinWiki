/**
 * MCP-specific blocking property validation.
 *
 * Unlike the advisory validatePageType (used by REST API), this function
 * throws on any schema violation. It handles:
 * - Unknown properties (not in page type schema)
 * - Missing required properties
 * - Type mismatches against schema
 * - Default value auto-fill for create operations
 * - Null-to-delete validation (cannot delete required properties)
 */

import { PageProperty, PageTypeDefinition } from '../../types/index.js';
import { getPageType } from '../../page-types/page-types-service.js';

export interface McpPropertyValidationResult {
  /** Properties after validation — may include auto-filled defaults */
  properties: Record<string, PageProperty>;
}

/**
 * Validate properties against a page type schema for create operations.
 * Throws on any violation. Auto-fills defaults for omitted non-required properties.
 */
export async function validatePropertiesForCreate(
  pageTypeGuid: string,
  properties: Record<string, PageProperty>
): Promise<McpPropertyValidationResult> {
  const typeDef = await getPageType(pageTypeGuid);
  if (!typeDef) {
    throw new Error(`Page type '${pageTypeGuid}' not found`);
  }

  validateNoUnknownProperties(typeDef, properties);
  validateRequiredProperties(typeDef, properties);
  validatePropertyTypes(typeDef, properties);

  const filled = applyDefaults(typeDef, properties);
  return { properties: filled };
}

/**
 * Validate properties against a page type schema for update operations.
 * Takes the merged result (existing + updates with nulls applied) and validates
 * the final state. Throws on any violation. Does not auto-fill defaults.
 */
export async function validatePropertiesForUpdate(
  pageTypeGuid: string,
  mergedProperties: Record<string, PageProperty>
): Promise<void> {
  const typeDef = await getPageType(pageTypeGuid);
  if (!typeDef) {
    throw new Error(`Page type '${pageTypeGuid}' not found`);
  }

  validateNoUnknownProperties(typeDef, mergedProperties);
  validateRequiredProperties(typeDef, mergedProperties);
  validatePropertyTypes(typeDef, mergedProperties);
}

function validateNoUnknownProperties(
  typeDef: PageTypeDefinition,
  properties: Record<string, PageProperty>
): void {
  const schemaNames = new Set(typeDef.properties.map(p => p.name));
  for (const key of Object.keys(properties)) {
    if (!schemaNames.has(key)) {
      throw new Error(
        `Property '${key}' is not defined in page type '${typeDef.name}'. ` +
        `Allowed properties: ${typeDef.properties.map(p => p.name).join(', ')}`
      );
    }
  }
}

function validateRequiredProperties(
  typeDef: PageTypeDefinition,
  properties: Record<string, PageProperty>
): void {
  for (const schemaProp of typeDef.properties) {
    if (schemaProp.required && !properties[schemaProp.name]) {
      throw new Error(
        `Required property '${schemaProp.name}' is missing for page type '${typeDef.name}'`
      );
    }
  }
}

function validatePropertyTypes(
  typeDef: PageTypeDefinition,
  properties: Record<string, PageProperty>
): void {
  for (const schemaProp of typeDef.properties) {
    const prop = properties[schemaProp.name];
    if (prop && prop.type !== schemaProp.type) {
      throw new Error(
        `Property '${schemaProp.name}' has type '${prop.type}' but page type '${typeDef.name}' expects '${schemaProp.type}'`
      );
    }
  }
}

function applyDefaults(
  typeDef: PageTypeDefinition,
  properties: Record<string, PageProperty>
): Record<string, PageProperty> {
  const result = { ...properties };
  for (const schemaProp of typeDef.properties) {
    if (!result[schemaProp.name] && !schemaProp.required && schemaProp.defaultValue !== undefined) {
      result[schemaProp.name] = {
        type: schemaProp.type,
        value: schemaProp.defaultValue,
      };
    }
  }
  return result;
}
