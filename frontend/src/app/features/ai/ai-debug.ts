/**
 * AI debug utility — ports `frontend/src/utils/aiDebug.ts`.
 *
 * Gating: enabled by query param `?aiDebug=1`, localStorage `aiDebug=true`,
 * or when `environment.production === false` (the Angular equivalent of
 * Vite's `import.meta.env.DEV`). Default-on so diagnostics are visible.
 */

import { environment } from '../../../environments/environment';

let cachedEnabled: boolean | null = null;

function computeAiDebugEnabled(): boolean {
  if (typeof window === 'undefined') return !environment.production;
  const params = new URLSearchParams(window.location.search);
  const queryEnabled =
    params.get('aiDebug') === '1' || params.get('aiDebug') === 'true';
  const localEnabled = window.localStorage.getItem('aiDebug') === 'true';
  // Default to enabled unless explicitly disabled so diagnostics are visible.
  return queryEnabled || localEnabled || !environment.production;
}

function isEnabled(): boolean {
  if (cachedEnabled === null) {
    cachedEnabled = computeAiDebugEnabled();
  }
  return cachedEnabled;
}

export function isAiDebugEnabled(): boolean {
  return isEnabled();
}

export function aiNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function aiElapsedMs(start: number): number {
  return Math.round((aiNow() - start) * 10) / 10;
}

export function aiDebug(event: string, data?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  const prefix = `[AI Chat][${new Date().toISOString()}] ${event}`;
  if (!data) {
    console.log(prefix);
    return;
  }
  console.log(prefix, sanitizeForLog(data));
}

function sanitizeForLog(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      out[key] = value.length > 300 ? `${value.slice(0, 300)}…` : value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Test-only: reset the cached enabled flag so tests can re-compute. */
export function __resetAiDebugForTests(): void {
  cachedEnabled = null;
}
