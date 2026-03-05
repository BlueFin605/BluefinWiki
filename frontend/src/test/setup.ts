/**
 * Test setup file for Vitest
 * Configures global test environment and imports
 */

import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock CodeMirror DOM APIs
if (typeof document !== 'undefined') {
  // Mock createRange for CodeMirror
  document.createRange = () => {
    const range = new Range();
    
    range.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => {},
    }));
    
    range.getClientRects = vi.fn(() => ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* (): Generator<DOMRect, undefined, unknown> {},
    } as DOMRectList));
    
    return range;
  };

  // Mock Selection API for CodeMirror
  if (!window.getSelection) {
    window.getSelection = vi.fn(() => ({
      rangeCount: 0,
      addRange: vi.fn(),
      removeAllRanges: vi.fn(),
      getRangeAt: vi.fn(),
      toString: () => '',
      type: 'None',
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
      isCollapsed: true,
      collapse: vi.fn(),
      collapseToEnd: vi.fn(),
      collapseToStart: vi.fn(),
      containsNode: vi.fn(() => false),
      deleteFromDocument: vi.fn(),
      empty: vi.fn(),
      extend: vi.fn(),
      modify: vi.fn(),
      selectAllChildren: vi.fn(),
      setBaseAndExtent: vi.fn(),
      setPosition: vi.fn(),
    } as unknown as Selection)) as () => Selection;
  }

  // Mock scrollIntoView for JSDOM
  Element.prototype.scrollIntoView = vi.fn();
}

// Suppress JSDOM undici errors that don't affect test results
// These are internal JSDOM issues with fetch/XMLHttpRequest handling
const originalConsoleError = console.error;
const originalUnhandledRejection = process.listeners('unhandledRejection');

// Remove default handlers
process.removeAllListeners('unhandledRejection');

// Add custom handler that filters out known JSDOM issues
process.on('unhandledRejection', (reason: any) => {
  // Suppress known JSDOM/undici errors
  if (
    reason?.code === 'UND_ERR_INVALID_ARG' ||
    (reason?.message && reason.message.includes('invalid onError method'))
  ) {
    // Silently ignore these JSDOM internal errors
    return;
  }
  
  // For other errors, use the original handlers or log them
  if (originalUnhandledRejection.length > 0) {
    originalUnhandledRejection.forEach((handler) => {
      if (typeof handler === 'function') {
        handler(reason, Promise.reject(reason));
      }
    });
  } else {
    console.error('Unhandled Rejection:', reason);
  }
});

// Export expect for convenience
export { expect };

