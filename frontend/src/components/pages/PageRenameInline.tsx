/**
 * PageRenameInline Component
 * 
 * Inline editing component for renaming pages
 * - Click to edit mode
 * - Save on Enter or blur
 * - Cancel on Escape
 * - Validates title before saving
 */

import React, { useState, useEffect, useRef } from 'react';
import { PageTreeNode } from '../../types/page';
import { useUpdatePage } from '../../hooks/usePages';

interface PageRenameInlineProps {
  page: PageTreeNode;
  onComplete: () => void;
  onCancel: () => void;
}

export const PageRenameInline: React.FC<PageRenameInlineProps> = ({
  page,
  onComplete,
  onCancel,
}) => {
  const [title, setTitle] = useState(page.title);
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const updatePage = useUpdatePage(page.guid);

  // Focus input on mount and select all text
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const validateTitle = (value: string): boolean => {
    if (!value.trim()) {
      setError('Title cannot be empty');
      return false;
    }
    if (value.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return false;
    }
    if (value.trim().length > 100) {
      setError('Title must be less than 100 characters');
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();

    // If title hasn't changed, just cancel
    if (trimmedTitle === page.title) {
      onCancel();
      return;
    }

    if (!validateTitle(trimmedTitle)) {
      return;
    }

    try {
      await updatePage.mutateAsync({
        title: trimmedTitle,
      });
      onComplete();
    } catch (err) {
      console.error('Failed to rename page:', err);
      setError('Failed to rename page. Please try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Save on blur, unless there's an error
    if (!error) {
      handleSave();
    }
  };

  return (
    <div className="inline-block w-full">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`
          w-full px-2 py-1 border-2 rounded
          focus:outline-hidden focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-500' : 'border-blue-500'}
        `}
        disabled={updatePage.isPending}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
};
