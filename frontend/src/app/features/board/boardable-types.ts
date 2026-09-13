import type { PageTypeDefinition } from '../pages/page.types';

/**
 * React parity (step 5.5): Board Settings' "Show pages of type" target-type
 * list is filtered to *boardable* types — those whose schema defines a
 * `state` property, since a deep board groups cards by their `state` value.
 * Types with no `state` property have nothing to group by and are excluded.
 *
 * Uses the same "state-bearing" test as step 5.1's
 * {@link isBoardEligible}(`is-board-eligible.ts`) — `properties.some(p =>
 * p.name === 'state')` — so a type that makes a page auto-eligible for a
 * board is exactly the set of types offered here.
 *
 * Pure and side-effect free; preserves input order.
 */
export function boardableTypes(
  pageTypes: readonly PageTypeDefinition[],
): PageTypeDefinition[] {
  return pageTypes.filter((t) => t.properties.some((p) => p.name === 'state'));
}
