import type { PageProperty, PageTypeProperty } from './page.types';

/**
 * Build the property set for a page under a page-type schema.
 *
 * For every field in `newSchema`, in schema order:
 *  - keep the existing property's value when a property of the same **name**
 *    exists AND its stored `type` still matches the schema field's type;
 *  - otherwise seed the schema default — the field's `defaultValue`, or a
 *    type-appropriate empty (`[]` for `tags`, `''` for everything else) when it
 *    has none.
 *
 * Properties whose name is not in `newSchema` are **dropped**. React parity: a
 * page-type change merges the new schema in and keeps only the values whose
 * name+type still apply (`react-frontend-page-reference.md` §5.1 Properties;
 * `angular-frontend-gap-analysis.md` row "Properties — Page Type"). Ad-hoc
 * (non-schema) property support is step 4.7's concern, not this helper's.
 *
 * Output key order is the schema order, so the result is deterministic
 * regardless of `existingProps` iteration order. Pure — inputs are never
 * mutated and array values are cloned.
 *
 * Shared helper: step 2.6's `buildInheritedProperties` (parent-property
 * inheritance) and step 4.7's custom-properties editor ("schema fields merged
 * with saved values") build on the same contract — keep them consistent.
 */
export function mergeSchema(
  existingProps: Readonly<Record<string, PageProperty>> | null | undefined,
  newSchema: readonly PageTypeProperty[],
): Record<string, PageProperty> {
  const existing = existingProps ?? {};
  const merged: Record<string, PageProperty> = {};
  for (const fieldDef of newSchema) {
    const current = existing[fieldDef.name];
    const value =
      current && current.type === fieldDef.type
        ? cloneValue(current.value)
        : schemaDefault(fieldDef);
    merged[fieldDef.name] = { type: fieldDef.type, value };
  }
  return merged;
}

function schemaDefault(fieldDef: PageTypeProperty): PageProperty['value'] {
  if (fieldDef.defaultValue !== undefined && fieldDef.defaultValue !== null) {
    return cloneValue(fieldDef.defaultValue);
  }
  return fieldDef.type === 'tags' ? [] : '';
}

function cloneValue(value: PageProperty['value']): PageProperty['value'] {
  return Array.isArray(value) ? [...value] : value;
}
