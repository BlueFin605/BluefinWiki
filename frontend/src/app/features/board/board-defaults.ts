import type { BoardConfig } from '../pages/page.types';
import { configuredTypeGuids } from './card-types';

export type BoardGroup = 'columns' | 'colors' | 'cards' | 'depth' | 'showParentTitle' | 'swapTitles' | 'defaultView';

const GROUP_KEYS: Record<BoardGroup, readonly (keyof BoardConfig)[]> = {
  columns: ['columns'],
  colors: ['colors'],
  cards: ['leafTypes', 'targetTypeGuids', 'targetTypeGuid'],
  depth: ['depth'],
  showParentTitle: ['showParentTitle'],
  swapTitles: ['swapTitles'],
  defaultView: ['defaultView'],
};

export const BOARD_GROUPS = Object.keys(GROUP_KEYS) as readonly BoardGroup[];

function setsGroup(cfg: BoardConfig, g: BoardGroup): boolean {
  return GROUP_KEYS[g].some((k) => cfg[k] !== undefined);
}

function pick(cfg: BoardConfig, g: BoardGroup): BoardConfig {
  const out: BoardConfig = {};
  for (const k of GROUP_KEYS[g]) if (cfg[k] !== undefined) (out as Record<string, unknown>)[k] = cfg[k];
  return out;
}

/** Groups this page sets itself (only meaningful when its type has defaults). */
export function overriddenGroups(pageCfg: BoardConfig | null | undefined): BoardGroup[] {
  return pageCfg ? BOARD_GROUPS.filter((g) => setsGroup(pageCfg, g)) : [];
}

/** Type defaults overlaid, group by group, with the page's own settings. */
export function effectiveBoardConfig(
  pageCfg: BoardConfig | null | undefined,
  typeDefaults: BoardConfig | null | undefined,
): BoardConfig | null {
  if (!typeDefaults) return pageCfg ?? null;
  const out: BoardConfig = {};
  for (const g of BOARD_GROUPS) {
    Object.assign(out, pick(pageCfg && setsGroup(pageCfg, g) ? pageCfg : typeDefaults, g));
  }
  if (pageCfg?.keyPrefix) out.keyPrefix = pageCfg.keyPrefix;
  return Object.keys(out).length ? out : null;
}

/** Re-applies the page-only settings (keyPrefix) from the page's current config onto `cfg`. */
export function withPageOnly(cfg: BoardConfig | null, pageCfg: BoardConfig | null | undefined): BoardConfig | null {
  const out: BoardConfig = { ...(cfg ?? {}) };
  if (pageCfg?.keyPrefix) out.keyPrefix = pageCfg.keyPrefix;
  return Object.keys(out).length ? out : null;
}

/** Strips page-only settings (keyPrefix), for writing type defaults. */
export function withoutPageOnly(cfg: BoardConfig): BoardConfig {
  const rest: BoardConfig = { ...cfg };
  delete rest.keyPrefix;
  return rest;
}

/** A group's value with absent keys normalised, for comparison and explicit writing. */
function normalised(cfg: BoardConfig, g: BoardGroup): BoardConfig {
  switch (g) {
    case 'columns': return { columns: cfg.columns ?? [] };
    // Keys sorted: the comparison is a JSON.stringify, which is key-order sensitive.
    case 'colors': return { colors: Object.fromEntries(Object.entries(cfg.colors ?? {}).sort(([a], [b]) => a.localeCompare(b))) };
    case 'cards':
      if (cfg.leafTypes) return { leafTypes: true };
      return configuredTypeGuids(cfg).length ? { targetTypeGuids: configuredTypeGuids(cfg) } : { leafTypes: false };
    case 'depth': return { depth: cfg.depth ?? 10 };
    case 'showParentTitle': return { showParentTitle: cfg.showParentTitle ?? true };
    case 'swapTitles': return { swapTitles: cfg.swapTitles ?? false };
    case 'defaultView': return { defaultView: cfg.defaultView ?? 'content' };
  }
}

/** The groups of `full` that differ from `typeDefaults`, written explicitly; null when none differ. */
export function boardOverrides(full: BoardConfig, typeDefaults: BoardConfig): BoardConfig | null {
  const out: BoardConfig = {};
  for (const g of BOARD_GROUPS) {
    const mine = normalised(full, g);
    if (JSON.stringify(mine) !== JSON.stringify(normalised(typeDefaults, g))) Object.assign(out, mine);
  }
  return Object.keys(out).length ? out : null;
}
