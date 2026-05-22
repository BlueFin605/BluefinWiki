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

function readStored(): LayoutPreferences {
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

  update(changes: Partial<LayoutPreferences>): void {
    this._prefs.update((prev) => ({ ...prev, ...changes }));
  }
}
