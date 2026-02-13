import { useEffect, useRef, useState, useCallback } from 'react';

export interface AutosaveOptions {
  /** Debounce delay in milliseconds (default: 5000) */
  delay?: number;
  /** Callback to execute when autosave is triggered */
  onSave: () => Promise<void> | void;
  /** Enable or disable autosave */
  enabled?: boolean;
}

export interface AutosaveState {
  /** Whether content is currently being saved */
  isSaving: boolean;
  /** Timestamp of last successful save */
  lastSaved: Date | null;
  /** Error from last save attempt */
  error: Error | null;
  /** Whether there are unsaved changes */
  isDirty: boolean;
}

/**
 * Custom hook for implementing autosave with debouncing
 * 
 * Features:
 * - Debounced save (configurable delay)
 * - Tracks save state (saving, last saved, errors)
 * - Tracks dirty state (unsaved changes)
 * - Manual save trigger
 * 
 * @example
 * const { isSaving, lastSaved, isDirty, triggerSave } = useAutosave({
 *   onSave: async () => await saveContent(),
 *   delay: 5000,
 * });
 */
export const useAutosave = (
  content: string,
  options: AutosaveOptions
): AutosaveState & { triggerSave: () => void } => {
  const { delay = 5000, onSave, enabled = true } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastContentRef = useRef<string>(content);

  /**
   * Trigger a save operation
   */
  const triggerSave = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsSaving(true);
      setError(null);
      await onSave();
      setLastSaved(new Date());
      setIsDirty(false);
      lastContentRef.current = content;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Save failed'));
      console.error('Autosave error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave, enabled]);

  /**
   * Debounced autosave effect
   */
  useEffect(() => {
    // Skip if autosave is disabled
    if (!enabled) return;

    // Skip if content hasn't changed
    if (content === lastContentRef.current) return;

    // Mark as dirty
    setIsDirty(true);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for autosave
    timeoutRef.current = setTimeout(() => {
      triggerSave();
    }, delay);

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, delay, enabled, triggerSave]);

  return {
    isSaving,
    lastSaved,
    error,
    isDirty,
    triggerSave,
  };
};

export default useAutosave;
