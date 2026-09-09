/**
 * Custom-property name rules, shared by the inspector's ad-hoc property form
 * (step 4.7). Mirrors the kebab-casing the page-types admin applies to schema
 * property names (`page-types-admin.ts` `kebabify`), but surfaces an explicit
 * rejection — the inspector wants the user to see *why* a name was refused
 * rather than silently rewriting it.
 */

/**
 * Kebab-case a raw name: lower-case, collapse whitespace to single hyphens,
 * drop anything that is not `[a-z0-9-]`, then squash repeated / edge hyphens.
 */
export function kebabCasePropertyName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface PropertyNameCheck {
  /** Whether the name may be used. */
  readonly ok: boolean;
  /** The kebab-cased form (`''` when the input has no usable characters). */
  readonly name: string;
  /** Human-readable reason when `ok` is false, otherwise `null`. */
  readonly error: string | null;
}

/**
 * Validate a user-entered custom-property name. It must be:
 *  - non-empty (after kebab-casing),
 *  - already kebab-case (no capitals, spaces or punctuation to rewrite),
 *  - not equal to an existing property key.
 */
export function validatePropertyName(
  raw: string,
  existingKeys: Iterable<string>,
): PropertyNameCheck {
  const kebab = kebabCasePropertyName(raw);

  if (kebab === '') {
    return { ok: false, name: '', error: 'Enter a property name.' };
  }
  if (raw.trim().toLowerCase() !== kebab) {
    return {
      ok: false,
      name: kebab,
      error: 'Use kebab-case: lower-case letters, digits and hyphens only.',
    };
  }
  for (const key of existingKeys) {
    if (key === kebab) {
      return { ok: false, name: kebab, error: `"${kebab}" already exists.` };
    }
  }
  return { ok: true, name: kebab, error: null };
}
