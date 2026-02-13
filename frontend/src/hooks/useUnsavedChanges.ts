import { useEffect, useCallback } from 'react';
import { useLocation, useBeforeUnload } from 'react-router-dom';

export interface UseUnsavedChangesOptions {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Custom message to display (default provided) */
  message?: string;
  /** Whether to enable the warning (default: true) */
  enabled?: boolean;
}

/**
 * Custom hook to warn users about unsaved changes when navigating away
 * 
 * Features:
 * - Browser navigation warning (closing tab, refreshing)
 * - React Router navigation warning (internal navigation)
 * - Configurable warning message
 * 
 * @example
 * useUnsavedChanges({
 *   isDirty: hasUnsavedChanges,
 *   message: 'You have unsaved changes. Are you sure you want to leave?',
 * });
 */
export const useUnsavedChanges = (options: UseUnsavedChangesOptions) => {
  const { isDirty, message = 'You have unsaved changes. Are you sure you want to leave?', enabled = true } = options;
  const location = useLocation();

  /**
   * Warn on browser navigation (close, refresh, back/forward)
   */
  useBeforeUnload(
    useCallback((e: BeforeUnloadEvent) => {
      if (enabled && isDirty) {
        e.preventDefault();
        // Modern browsers ignore custom messages and show their own
        // But we still need to set returnValue for the warning to trigger
        e.returnValue = message;
        return message;
      }
    }, [enabled, isDirty, message]),
    { capture: true }
  );

  /**
   * Warn on React Router navigation (internal links)
   * Note: React Router v6 doesn't have a built-in way to block navigation
   * This is a simplified version - in production, consider using a custom blocker
   */
  useEffect(() => {
    if (!enabled || !isDirty) return;

    // Add event listener for navigation attempts
    const handleNavigation = (e: Event) => {
      if (isDirty) {
        const confirmLeave = window.confirm(message);
        if (!confirmLeave) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Listen for clicks on links
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      link.addEventListener('click', handleNavigation);
    });

    return () => {
      links.forEach(link => {
        link.removeEventListener('click', handleNavigation);
      });
    };
  }, [enabled, isDirty, message, location]);
};

export default useUnsavedChanges;
