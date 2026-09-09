import type { PageProperty, PageTypeProperty } from './page.types';

/**
 * Merge a page-type schema into a page's existing properties — a **union
 * merge**: no stored value is ever dropped by a type change.
 *
 * Output, in this order:
 *  1. every field in `newSchema`, in schema order — keeping the existing
 *     property's value when a property of the same **name** exists AND its
 *     stored `type` still matches the field type, otherwise seeding the schema
 *     default (`field.defaultValue`, or `[]` for `tags` / `''` for everything
 *     else when it has none). An existing value of an incompatible type is
 *     replaced by the schema default.
 *  2. then every existing property whose name is **not** in `newSchema`,
 *     untouched, in its original insertion order.
 *
 * So a page-type switch A→B→A round-trips every value, and ad-hoc (non-schema)
 * properties survive. React parity: the inspector "merges the type's property
 * schema in" while the custom-properties editor shows "schema fields merged
 * with saved values" and keeps user-added ad-hoc props
 * (`react-frontend-page-reference.md` Inspector §1 "Properties" +
 * "Card Summary dialog"; `angular-frontend-gap-analysis.md` rows
 * "Properties — Page Type" / "Custom Properties"). Step 4.7 owns the UI that
 * displays and removes the non-schema props this helper preserves.
 *
 * Deterministic: output order is fixed (schema order, then existing-insertion
 * order) regardless of `existingProps` key order. Pure — inputs are never
 * mutated and array values are cloned. `mergeSchema(props, [])` returns a
 * cloned copy of `props`.
 *
 * Shared helper: step 2.6's `buildInheritedProperties` (parent-property
 * inheritance — keep the child value on a name+type match, else the
 * parent/schema default) builds on the same contract.
 */
export function mergeSchema(
  existingProps: Readonly<Record<string, PageProperty>> | null | undefined,
  newSchema: readonly PageTypeProperty[],
): Record<string, PageProperty> {
  const existing = existingProps ?? {};
  const schemaNames = new Set(newSchema.map((f) => f.name));
  const merged: Record<string, PageProperty> = {};

  // 1. Schema fields, in schema order.
  for (const fieldDef of newSchema) {
    const current = existing[fieldDef.name];
    const value =
      current && current.type === fieldDef.type
        ? cloneValue(current.value)
        : schemaDefault(fieldDef);
    merged[fieldDef.name] = { type: fieldDef.type, value };
  }

  // 2. Remaining (non-schema) existing props, in their original order.
  for (const [name, prop] of Object.entries(existing)) {
    if (schemaNames.has(name)) continue;
    merged[name] = { type: prop.type, value: cloneValue(prop.value) };
  }

  return merged;
}

function schemaDefault(fieldDef: PageTypeProperty): PageProperty['value'] {
  if (fieldDef.defaultValue !== undefined) {
    return cloneValue(fieldDef.defaultValue);
  }
  return fieldDef.type === 'tags' ? [] : '';
}

function cloneValue(value: PageProperty['value']): PageProperty['value'] {
  return Array.isArray(value) ? [...value] : value;
}
