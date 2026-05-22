import type { BoardConfig, PageChildDetail } from '../pages/page.types';

export const UNCATEGORISED = 'Uncategorised';

const DEFAULT_COLORS: Record<string, string> = {
  Backlog: '#6b7280',
  'To Do': '#6b7280',
  'In Progress': '#3b82f6',
  Watching: '#3b82f6',
  Review: '#f59e0b',
  Done: '#22c55e',
  Completed: '#22c55e',
  Archived: '#9ca3af',
};

export interface BoardGrouping {
  columns: string[];
  cardsByColumn: Record<string, PageChildDetail[]>;
}

/**
 * Pure grouping helper for the Board view. Buckets children by their
 * `state` property; cards lacking a string `state` value go to a synthetic
 * `Uncategorised` column. Column ordering rules:
 *  - When `boardConfig.columns` is given, its order wins. Unconfigured
 *    states are appended in alphabetical order.
 *  - Otherwise columns are alphabetical.
 *  - `Uncategorised` always last, and only if it has cards.
 *  - Configured columns are always present, even when empty.
 *
 * Within a column, cards are sorted by `boardOrder` ascending (cards with
 * an explicit `boardOrder` first), then by `modifiedAt` descending.
 */
export function groupByState(
  children: readonly PageChildDetail[],
  boardConfig?: BoardConfig,
): BoardGrouping {
  const byState: Record<string, PageChildDetail[]> = {};

  for (const child of children) {
    const stateValue = child.properties?.['state']?.value;
    const state = typeof stateValue === 'string' && stateValue ? stateValue : UNCATEGORISED;
    if (!byState[state]) byState[state] = [];
    byState[state].push(child);
  }

  for (const state of Object.keys(byState)) {
    byState[state].sort((a, b) => {
      const aHasOrder = a.boardOrder !== undefined;
      const bHasOrder = b.boardOrder !== undefined;
      if (aHasOrder && bHasOrder) return (a.boardOrder ?? 0) - (b.boardOrder ?? 0);
      if (aHasOrder) return -1;
      if (bHasOrder) return 1;
      return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
    });
  }

  let orderedColumns: string[];
  if (boardConfig?.columns?.length) {
    const configuredSet = new Set(boardConfig.columns);
    const unconfigured = Object.keys(byState)
      .filter((s) => !configuredSet.has(s) && s !== UNCATEGORISED)
      .sort();
    orderedColumns = [...boardConfig.columns, ...unconfigured];
    for (const col of boardConfig.columns) {
      if (!byState[col]) byState[col] = [];
    }
  } else {
    orderedColumns = Object.keys(byState).filter((s) => s !== UNCATEGORISED).sort();
  }

  if (byState[UNCATEGORISED]?.length) {
    orderedColumns.push(UNCATEGORISED);
  }

  return { columns: orderedColumns, cardsByColumn: byState };
}

/**
 * Resolve a colour for the given column name, preferring a configured
 * override, then a well-known default, and finally a stable hash-derived
 * HSL colour so unknown column names get a consistent fallback hue.
 */
export function getColumnColor(name: string, configColors?: Record<string, string>): string {
  if (configColors?.[name]) return configColors[name];
  if (DEFAULT_COLORS[name]) return DEFAULT_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 50%)`;
}
