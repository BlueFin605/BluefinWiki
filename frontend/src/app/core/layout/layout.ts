import { Injectable, computed, effect, signal } from '@angular/core';

export interface LayoutPreferences {
  treeWidth: number;
  inspectorWidth: number;
  inspectorVisible: boolean;
  editorSplitPosition: number;
}

const STORAGE_KEY = 'bluefinwiki-layout';

const DEFAULTS: LayoutPreferences = {
  treeWidth: 320,
  inspectorWidth: 320,
  inspectorVisible: false,
  editorSplitPosition: 50,
};

/** Inclusive [min, max] bounds for each numeric preference. */
const CLAMPS: Record<'treeWidth' | 'inspectorWidth' | 'editorSplitPosition', readonly [number, number]> = {
  treeWidth: [200, 600],
  inspectorWidth: [250, 600],
  editorSplitPosition: [20, 80],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function readStored(): LayoutPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<LayoutPreferences>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

@Injectable({ providedIn: 'root' })
export class Layout {
  private readonly _prefs = signal<LayoutPreferences>(readStored());

  readonly preferences = this._prefs.asReadonly();
  readonly treeWidth = computed(() => this._prefs().treeWidth);
  readonly inspectorWidth = computed(() => this._prefs().inspectorWidth);
  readonly inspectorVisible = computed(() => this._prefs().inspectorVisible);
  readonly editorSplitPosition = computed(() => this._prefs().editorSplitPosition);

  constructor() {
    effect(() => {
      const prefs = this._prefs();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        // storage unavailable — keep signal value in memory only
      }
    });
  }

  /**
   * The single choke point for layout mutations. Numeric keys are clamped to
   * their bounds (see `CLAMPS`) before the patch is applied; non-numeric keys
   * (`inspectorVisible`) pass through untouched. The constructor `effect()`
   * then persists the whole prefs object to localStorage.
   */
  update(changes: Partial<LayoutPreferences>): void {
    const next: Partial<LayoutPreferences> = { ...changes };
    for (const key of Object.keys(CLAMPS) as (keyof typeof CLAMPS)[]) {
      const value = next[key];
      if (typeof value === 'number') {
        const [min, max] = CLAMPS[key];
        next[key] = clamp(value, min, max);
      }
    }
    this._prefs.update((prev) => ({ ...prev, ...next }));
  }
}
