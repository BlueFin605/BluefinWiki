import type { BoardConfig, PageTypeDefinition } from '../pages/page.types';
import { boardableTypes } from './boardable-types';

/**
 * Leaf types: boardable page types (they define `state`) whose
 * `allowedChildTypes` contains no boardable type — i.e. where the work
 * actually happens (Task, Bug, Season…), as opposed to containers that also
 * carry a state (Epic, Story, TV Show…). Preserves input order.
 */
export function leafTypes(pageTypes: readonly PageTypeDefinition[]): PageTypeDefinition[] {
  const boardable = boardableTypes(pageTypes);
  const boardableGuids = new Set(boardable.map((t) => t.guid));
  return boardable.filter((t) => !t.allowedChildTypes.some((g) => boardableGuids.has(g)));
}

/**
 * The leaf types an edit to one page type would knock out of leaf mode — e.g.
 * letting Task hold Bug makes Task a container, so leaf-mode boards stop
 * showing Task cards. `edited` replaces the type with its guid. A new type
 * (`null` guid) is nobody's allowed child yet, so it can't cost a leaf.
 * Drives the page-type editor's warning.
 */
export function leafTypesLost(
  pageTypes: readonly PageTypeDefinition[],
  edited: Pick<PageTypeDefinition, 'properties' | 'allowedChildTypes'> & { guid: string | null },
): PageTypeDefinition[] {
  if (edited.guid === null) return [];
  const after = pageTypes.map((t) =>
    t.guid === edited.guid
      ? { ...t, properties: edited.properties, allowedChildTypes: edited.allowedChildTypes }
      : t,
  );
  const stillLeaf = new Set(leafTypes(after).map((t) => t.guid));
  return leafTypes(pageTypes).filter((t) => !stillLeaf.has(t.guid));
}

/** The explicitly configured card types; reads the legacy single `targetTypeGuid` as a one-item list. */
export function configuredTypeGuids(cfg: BoardConfig | null | undefined): string[] {
  if (cfg?.targetTypeGuids?.length) return [...cfg.targetTypeGuids];
  return cfg?.targetTypeGuid ? [cfg.targetTypeGuid] : [];
}

/** True when the board collects typed descendants (leaf mode or specific types) rather than direct children. */
export function hasCardTypeSelection(cfg: BoardConfig | null | undefined): boolean {
  return cfg?.leafTypes === true || configuredTypeGuids(cfg).length > 0;
}

/** The page-type guids this board collects right now. Empty = direct children. */
export function resolveCardTypes(
  cfg: BoardConfig | null | undefined,
  pageTypes: readonly PageTypeDefinition[],
): string[] {
  if (cfg?.leafTypes) return leafTypes(pageTypes).map((t) => t.guid);
  return configuredTypeGuids(cfg);
}
