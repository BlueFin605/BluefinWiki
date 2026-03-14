/**
 * Layout preferences store
 *
 * Persists panel sizes and visibility to localStorage so they
 * survive page navigation and browser sessions.
 */

const STORAGE_KEY = 'bluefinwiki-layout';

export interface LayoutPreferences {
  treeWidth: number;
  inspectorWidth: number;
  inspectorVisible: boolean;
  editorSplitPosition: number;
}

const DEFAULTS: LayoutPreferences = {
  treeWidth: 320,
  inspectorWidth: 320,
  inspectorVisible: false,
  editorSplitPosition: 50,
};

let cached: LayoutPreferences | null = null;

export function getLayout(): LayoutPreferences {
  if (cached) return cached;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cached = { ...DEFAULTS, ...JSON.parse(raw) } as LayoutPreferences;
      return cached;
    }
  } catch {
    // ignore corrupt data
  }

  cached = { ...DEFAULTS };
  return cached;
}

export function setLayout(changes: Partial<LayoutPreferences>): void {
  cached = { ...getLayout(), ...changes };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // localStorage full or unavailable
  }
}
