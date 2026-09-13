import { mergeSchema } from './merge-schema';
import type { PageProperty, PageTypeProperty } from './page.types';

/**
 * Build a new page's initial `properties` from its chosen type's schema,
 * inheriting the *parent* page's same-name/same-type values in place of the
 * schema default (New Page modal, step 2.6): "start from the chosen type's
 * schema defaults, overlay any parent property whose name and type match."
 *
 * That is exactly `mergeSchema`'s contract with the parent's properties
 * standing in as the "existing" set to merge from — see `merge-schema.ts`
 * for the full semantics (schema order, per-type default seeding, and the
 * union merge that also carries over any parent property not in the new
 * schema). This helper is a thin, named delegate so call sites read as
 * "inherit from the parent" rather than "merge a schema into existing
 * values" — the two ideas share one implementation by design (see
 * `merge-schema.ts`'s own doc comment, which already names this helper).
 */
export function buildInheritedProperties(
  schema: readonly PageTypeProperty[],
  parentProps: Readonly<Record<string, PageProperty>> | null | undefined,
): Record<string, PageProperty> {
  return mergeSchema(parentProps, schema);
}
