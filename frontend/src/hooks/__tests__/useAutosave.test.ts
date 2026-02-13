/**
 * Tests for useAutosave hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

describe('useAutosave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Don't use fake timers - they cause issues with async operations in hooks
  });

  afterEach(() => {
    // cleanup
  });

  describe('Basic Functionality', () => {
    it('should initialize with default state', () => {
      const onSave = vi.fn();
      const { result } = renderHook(() =>
        useAutosave('initial content', { onSave })
      );

      expect(result.current.isSaving).toBe(false);
      expect(result.current.lastSaved).toBe(null);
      expect(result.current.error).toBe(null);
      expect(result.current.isDirty).toBe(false);
    });

    it('should mark as dirty when content changes', async () => {
      const onSave = vi.fn();
      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave }),
        { initialProps: { content: 'initial' } }
      );

      expect(result.current.isDirty).toBe(false);

      rerender({ content: 'updated' });

      // Allow state update to process
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('should call onSave after delay', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      // Wait for debounce delay
      await waitFor(
        () => {
          expect(onSave).toHaveBeenCalled();
        },
        { timeout: 200 }
      );
    });

    it('should debounce multiple rapid changes', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'v1' } }
      );

      // Rapid changes
      rerender({ content: 'v2' });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      rerender({ content: 'v3' });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      rerender({ content: 'v4' });

      // Should not have called save yet
      expect(onSave).not.toHaveBeenCalled();

      // Wait for delay from last change
      await waitFor(
        () => {
          expect(onSave).toHaveBeenCalledTimes(1);
        },
        { timeout: 200 }
      );
    });
  });

  describe('Save State Management', () => {
    it('should set isSaving to true during save', async () => {
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      const onSave = vi.fn().mockReturnValue(savePromise);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      await waitFor(
        () => {
          expect(result.current.isSaving).toBe(true);
        },
        { timeout: 200 }
      );

      await act(async () => {
        resolveSave!();
        await Promise.resolve();
      });

      await waitFor(
        () => {
          expect(result.current.isSaving).toBe(false);
        },
        { timeout: 200 }
      );
    });

    it('should set lastSaved timestamp after successful save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      await waitFor(
        () => {
          expect(result.current.lastSaved).toBeInstanceOf(Date);
          expect(result.current.isDirty).toBe(false);
        },
        { timeout: 200 }
      );
    });

    it('should clear dirty flag after successful save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      await waitFor(
        () => {
          expect(result.current.isDirty).toBe(true);
        },
        { timeout: 100 }
      );

      await waitFor(
        () => {
          expect(result.current.isDirty).toBe(false);
        },
        { timeout: 200 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should set error on save failure', async () => {
      const error = new Error('Save failed');
      const onSave = vi.fn().mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      await waitFor(
        () => {
          expect(result.current.error).toEqual(error);
          expect(result.current.isSaving).toBe(false);
        },
        { timeout: 200 }
      );

      consoleSpy.mockRestore();
    });

    it('should convert non-Error objects to Error', async () => {
      const onSave = vi.fn().mockRejectedValue('string error');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      await waitFor(
        () => {
          expect(result.current.error).toBeInstanceOf(Error);
          expect(result.current.error?.message).toBe('Save failed');
        },
        { timeout: 200 }
      );

      consoleSpy.mockRestore();
    });

    it('should log error to console', async () => {
      const error = new Error('Save failed');
      const onSave = vi.fn().mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      await waitFor(
        () => {
          expect(consoleSpy).toHaveBeenCalledWith('Autosave error:', error);
        },
        { timeout: 200 }
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Manual Save Trigger', () => {
    it('should provide triggerSave function', () => {
      const onSave = vi.fn();
      const { result } = renderHook(() =>
        useAutosave('content', { onSave })
      );

      expect(result.current.triggerSave).toBeInstanceOf(Function);
    });

    it('should save immediately when triggerSave is called', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAutosave('content', { onSave })
      );

      await act(async () => {
        result.current.triggerSave();
      });

      await waitFor(
        () => {
          expect(onSave).toHaveBeenCalled();
        },
        { timeout: 100 }
      );
    });

    it('should bypass delay when using triggerSave', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAutosave('content', { onSave, delay: 10000 })
      );

      await act(async () => {
        result.current.triggerSave();
      });

      // Should save immediately without waiting for delay
      await waitFor(
        () => {
          expect(onSave).toHaveBeenCalled();
        },
        { timeout: 100 }
      );
    });
  });

  describe('Enabled/Disabled State', () => {
    it('should not save when enabled is false', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, enabled: false, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      // Wait a bit to ensure save doesn't happen
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should not call triggerSave when enabled is false', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAutosave('content', { onSave, enabled: false })
      );

      await act(async () => {
        result.current.triggerSave();
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should resume saving when enabled changes to true', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderHook(
        ({ content, enabled }) => useAutosave(content, { onSave, enabled, delay: 50 }),
        { initialProps: { content: 'initial', enabled: false } }
      );

      // Change content while disabled
      rerender({ content: 'updated', enabled: false });

      // Wait to ensure save doesn't happen
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onSave).not.toHaveBeenCalled();

      // Enable autosave
      rerender({ content: 'updated', enabled: true });

      // Content hasn't changed, so it shouldn't trigger save
      // But if we change it again...
      rerender({ content: 'updated2', enabled: true });

      await waitFor(
        () => {
          expect(onSave).toHaveBeenCalled();
        },
        { timeout: 200 }
      );
    });
  });

  describe('Custom Delay', () => {
    it(
      'should use default delay of 5000ms',
      async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { rerender } = renderHook(
          ({ content }) => useAutosave(content, { onSave }),
          { initialProps: { content: 'initial' } }
        );

        rerender({ content: 'updated' });

        // Check it hasn't saved immediately
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(onSave).not.toHaveBeenCalled();

        // Wait for default delay (5000ms)
        await waitFor(
          () => {
            expect(onSave).toHaveBeenCalled();
          },
          { timeout: 6000 }
        );
      },
      { timeout: 10000 }
    );

    it('should use custom delay', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 100 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'updated' });

      await waitFor(
        () => {
          expect(onSave).toHaveBeenCalled();
        },
        { timeout: 300 }
      );
    });
  });

  describe('Content Tracking', () => {
    it('should not trigger save when content is unchanged', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'initial' } }
      );

      rerender({ content: 'initial' }); // Same content

      // Wait to ensure save doesn't happen
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should track content across saves', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, delay: 50 }),
        { initialProps: { content: 'v1' } }
      );

      // First change and save
      rerender({ content: 'v2' });

      await waitFor(
        () => {
          expect(onSave).toHaveBeenCalledTimes(1);
          expect(result.current.isDirty).toBe(false);
        },
        { timeout: 200 }
      );

      onSave.mockClear();

      // Second change and save
      rerender({ content: 'v3' });
      
      await waitFor(
        () => {
          expect(result.current.isDirty).toBe(true);
        },
        { timeout: 100 }
      );

      await waitFor(
        () => {
          expect(onSave).toHaveBeenCalledTimes(1);
        },
        { timeout: 200 }
      );
    });
  });
});
