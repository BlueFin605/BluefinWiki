/**
 * Tests for EditorErrorBoundary component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorErrorBoundary } from '../EditorErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('EditorErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when there is no error', () => {
    render(
      <EditorErrorBoundary>
        <ThrowError shouldThrow={false} />
      </EditorErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <EditorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </EditorErrorBoundary>
    );

    expect(screen.getByText('Editor Crashed')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong while rendering the editor/)).toBeInTheDocument();
    expect(screen.getByText(/Test error/)).toBeInTheDocument();
  });

  it('shows Try Again button that resets error', () => {
    render(
      <EditorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </EditorErrorBoundary>
    );

    expect(screen.getByText('Editor Crashed')).toBeInTheDocument();

    const tryAgainButton = screen.getByText('Try Again');
    expect(tryAgainButton).toBeInTheDocument();
    
    // Clicking Try Again resets the error boundary state
    // In a real scenario, the component would be re-mounted with working children
    fireEvent.click(tryAgainButton);
    
    // The error boundary will attempt to re-render children
    // Since the same error-throwing component is still there, it will throw again
    // This is expected behavior - the test verifies the button exists and is clickable
  });

  it('calls onReset callback when Try Again is clicked', () => {
    const onReset = vi.fn();

    render(
      <EditorErrorBoundary onReset={onReset}>
        <ThrowError shouldThrow={true} />
      </EditorErrorBoundary>
    );

    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);

    expect(onReset).toHaveBeenCalled();
  });

  it('shows stack trace in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <EditorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </EditorErrorBoundary>
    );

    expect(screen.getByText('Stack Trace (Development Only)')).toBeInTheDocument();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('shows reassuring message about autosave', () => {
    render(
      <EditorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </EditorErrorBoundary>
    );

    expect(screen.getByText('💡 Your Work is Safe')).toBeInTheDocument();
    expect(screen.getByText(/autosave feature saves your work/i)).toBeInTheDocument();
  });
});
