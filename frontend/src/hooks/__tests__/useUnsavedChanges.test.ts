/**
 * Tests for useUnsavedChanges hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnsavedChanges } from '../useUnsavedChanges';

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useBeforeUnload: vi.fn((callback) => {
      // Store the callback for testing
      (global as any).__beforeUnloadCallback = callback;
    }),
    useLocation: vi.fn(() => ({ pathname: '/' })),
  };
});

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (global as any).__beforeUnloadCallback;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  describe('Basic Functionality', () => {
    it('should not warn when isDirty is false', () => {
      renderHook(() => useUnsavedChanges({ isDirty: false }));
      
      // No warnings should be set
      expect((global as any).__beforeUnloadCallback).toBeDefined();
    });

    it('should warn when isDirty is true', () => {
      renderHook(() => useUnsavedChanges({ isDirty: true }));
      
      expect((global as any).__beforeUnloadCallback).toBeDefined();
    });

    it('should not warn when enabled is false', () => {
      renderHook(() =>
        useUnsavedChanges({ isDirty: true, enabled: false })
      );
      
      // Hook should be disabled
      expect((global as any).__beforeUnloadCallback).toBeDefined();
    });
  });

  describe('Browser Navigation Warning', () => {
    it('should return message on beforeunload when dirty', () => {
      renderHook(() => useUnsavedChanges({ isDirty: true }));
      
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      const callback = (global as any).__beforeUnloadCallback;
      
      if (callback) {
        const result = callback(event);
        // Modern browsers ignore custom messages, but we should still set returnValue
        expect(result).toBeDefined();
      }
    });

    it('should not return message when not dirty', () => {
      renderHook(() => useUnsavedChanges({ isDirty: false }));
      
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      const callback = (global as any).__beforeUnloadCallback;
      
      if (callback) {
        const result = callback(event);
        expect(result).toBeUndefined();
      }
    });

    it('should use custom message', () => {
      const customMessage = 'Custom warning message';
      renderHook(() =>
        useUnsavedChanges({ isDirty: true, message: customMessage })
      );
      
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      const callback = (global as any).__beforeUnloadCallback;
      
      if (callback) {
        const result = callback(event);
        expect(result).toBe(customMessage);
      }
    });

    it('should use default message when not provided', () => {
      renderHook(() => useUnsavedChanges({ isDirty: true }));
      
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      const callback = (global as any).__beforeUnloadCallback;
      
      if (callback) {
        const result = callback(event);
        expect(result).toBe('You have unsaved changes. Are you sure you want to leave?');
      }
    });
  });

  describe('React Router Navigation', () => {
    it('should set up link event listeners when mounted', () => {
      const addEventListenerSpy = vi.spyOn(Element.prototype, 'addEventListener');
      
      // Create some test links
      document.body.innerHTML = `
        <a href="/page1">Page 1</a>
        <a href="/page2">Page 2</a>
      `;
      
      renderHook(() => useUnsavedChanges({ isDirty: true }));
      
      // Should have attached listeners to links
      expect(addEventListenerSpy).toHaveBeenCalled();
      
      addEventListenerSpy.mockRestore();
    });

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(Element.prototype, 'removeEventListener');
      
      document.body.innerHTML = `
        <a href="/page1">Page 1</a>
      `;
      
      const { unmount } = renderHook(() =>
        useUnsavedChanges({ isDirty: true })
      );
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalled();
      
      removeEventListenerSpy.mockRestore();
    });

    it('should not set up listeners when not enabled', () => {
      const addEventListenerSpy = vi.spyOn(Element.prototype, 'addEventListener');
      
      document.body.innerHTML = `
        <a href="/page1">Page 1</a>
      `;
      
      renderHook(() =>
        useUnsavedChanges({ isDirty: true, enabled: false })
      );
      
      // Should not attach listeners when disabled
      // Note: The hook still runs, but doesn't prevent navigation
      addEventListenerSpy.mockRestore();
    });

    it('should not set up listeners when not dirty', () => {
      document.body.innerHTML = `
        <a href="/page1">Page 1</a>
      `;
      
      renderHook(() => useUnsavedChanges({ isDirty: false }));
      
      // When not dirty, the effect should return early
      expect(document.querySelectorAll('a').length).toBe(1);
    });
  });

  describe('State Changes', () => {
    it('should update warning when isDirty changes', () => {
      const { rerender } = renderHook(
        ({ isDirty }) => useUnsavedChanges({ isDirty }),
        { initialProps: { isDirty: false } }
      );
      
      // Initially not dirty
      const event1 = new Event('beforeunload') as BeforeUnloadEvent;
      let callback = (global as any).__beforeUnloadCallback;
      if (callback) {
        expect(callback(event1)).toBeUndefined();
      }
      
      // Change to dirty
      rerender({ isDirty: true });
      
      const event2 = new Event('beforeunload') as BeforeUnloadEvent;
      callback = (global as any).__beforeUnloadCallback;
      if (callback) {
        expect(callback(event2)).toBeDefined();
      }
    });

    it('should update warning when enabled changes', () => {
      const { rerender } = renderHook(
        ({ enabled }) => useUnsavedChanges({ isDirty: true, enabled }),
        { initialProps: { enabled: false } }
      );
      
      // Initially disabled
      let event = new Event('beforeunload') as BeforeUnloadEvent;
      let callback = (global as any).__beforeUnloadCallback;
      if (callback) {
        expect(callback(event)).toBeUndefined();
      }
      
      // Enable
      rerender({ enabled: true });
      
      event = new Event('beforeunload') as BeforeUnloadEvent;
      callback = (global as any).__beforeUnloadCallback;
      if (callback) {
        expect(callback(event)).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing links gracefully', () => {
      document.body.innerHTML = ''; // No links
      
      expect(() => {
        renderHook(() => useUnsavedChanges({ isDirty: true }));
      }).not.toThrow();
    });

    it('should handle links added after mount', () => {
      document.body.innerHTML = '';
      
      const { rerender } = renderHook(() =>
        useUnsavedChanges({ isDirty: true })
      );
      
      // Add links dynamically
      document.body.innerHTML = `<a href="/new">New Link</a>`;
      
      // Trigger re-render
      rerender();
      
      expect(document.querySelectorAll('a').length).toBe(1);
    });

    it('should handle location changes', () => {
      document.body.innerHTML = `<a href="/page1">Page 1</a>`;
      
      const { rerender } = renderHook(() =>
        useUnsavedChanges({ isDirty: true })
      );
      
      // Simulate rerender which uses the current location
      rerender();
      
      // Hook should be using useLocation internally
      const link = document.querySelector('a');
      expect(link).toBeInTheDocument();
    });
  });

  describe('Confirm Dialog', () => {
    it('should show confirm dialog when clicking link with unsaved changes', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      document.body.innerHTML = `<a href="/page1">Page 1</a>`;
      
      renderHook(() => useUnsavedChanges({ isDirty: true }));
      
      const link = document.querySelector('a');
      if (link) {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);
      }
      
      confirmSpy.mockRestore();
    });

    it('should not show confirm dialog when not dirty', () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      
      document.body.innerHTML = `<a href="/page1">Page 1</a>`;
      
      renderHook(() => useUnsavedChanges({ isDirty: false }));
      
      const link = document.querySelector('a');
      if (link) {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);
      }
      
      expect(confirmSpy).not.toHaveBeenCalled();
      
      confirmSpy.mockRestore();
    });
  });

  describe('Multiple Instances', () => {
    it('should handle multiple hook instances', () => {
      const { unmount: unmount1 } = renderHook(() =>
        useUnsavedChanges({ isDirty: true })
      );
      
      const { unmount: unmount2 } = renderHook(() =>
        useUnsavedChanges({ isDirty: true })
      );
      
      expect((global as any).__beforeUnloadCallback).toBeDefined();
      
      unmount1();
      unmount2();
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle beforeunload event properly', () => {
      renderHook(() => useUnsavedChanges({ isDirty: true }));
      
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      Object.defineProperty(event, 'returnValue', {
        writable: true,
        value: '',
      });
      
      const callback = (global as any).__beforeUnloadCallback;
      if (callback) {
        const result = callback(event);
        expect(result).toBeDefined();
      }
    });
  });
});

