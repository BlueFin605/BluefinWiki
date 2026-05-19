function computeAiDebugEnabled(): boolean {
  if (import.meta.env.VITE_AI_DEBUG === 'false') return false;
  if (typeof window === 'undefined') return import.meta.env.DEV || import.meta.env.VITE_AI_DEBUG === 'true';

  const params = new URLSearchParams(window.location.search);
  const queryEnabled = params.get('aiDebug') === '1' || params.get('aiDebug') === 'true';
  const localEnabled = window.localStorage.getItem('aiDebug') === 'true';

  // Default to enabled unless explicitly disabled so diagnostics are visible.
  return queryEnabled || localEnabled || import.meta.env.DEV || import.meta.env.VITE_AI_DEBUG !== 'false';
}

const AI_DEBUG_ENABLED = computeAiDebugEnabled();

export function isAiDebugEnabled(): boolean {
  return AI_DEBUG_ENABLED;
}

export function aiNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function aiElapsedMs(start: number): number {
  return Math.round((aiNow() - start) * 10) / 10;
}

export function aiDebug(event: string, data?: Record<string, unknown>): void {
  if (!AI_DEBUG_ENABLED) return;
  const prefix = `[AI Chat][${new Date().toISOString()}] ${event}`;
  if (!data) {
    console.log(prefix);
    return;
  }
  console.log(prefix, sanitizeForLog(data));
}

function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
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