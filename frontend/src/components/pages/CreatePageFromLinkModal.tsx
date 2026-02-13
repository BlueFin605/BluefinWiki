/**
 * CreatePageFromLinkModal Component
 * 
 * Modal for creating a new page from a broken wiki link with:
 * - Pre-filled title from link text
 * - Parent page selection (tree dropdown)
 * - Option to create as draft or published
 * - Automatic link update in source page after creation
 */

import React, { useState, useEffect } from 'react';
import { CreatePageRequest } from '../../types/page';
import { useCreatePage } from '../../hooks/usePages';

interface CreatePageFromLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkText: string;
  currentPageGuid?: string;
  onPageCreated?: (pageGuid: string, pageTitle: string) => void;
}

export const CreatePageFromLinkModal: React.FC<CreatePageFromLinkModalProps> = ({
  isOpen,
  onClose,
  linkText,
  currentPageGuid,
  onPageCreated,
}) => {
  const [title, setTitle] = useState('');
  const [parentGuid, setParentGuid] = useState<string | null>(currentPageGuid || null);
  const [isRootPage, setIsRootPage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createPage = useCreatePage();

  // Pre-fill title from link text when modal opens
  useEffect(() => {
    if (isOpen && linkText) {
      setTitle(linkText);
    }
  }, [isOpen, linkText]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (title.trim().length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    if (!isRootPage && !parentGuid) {
      newErrors.parent = 'Please select a parent page or create as root page';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const request: CreatePageRequest = {
      title: title.trim(),
      parentGuid: isRootPage ? null : parentGuid,
      content: `# ${title.trim()}\n\nStart writing your page content here...`,
    };

    try {
      const newPage = await createPage.mutateAsync(request);
      
      // Notify parent component that page was created
      if (onPageCreated && newPage) {
        onPageCreated(newPage.guid, newPage.title);
      }
      
      handleClose();
    } catch (error) {
      console.error('Failed to create page:', error);
      setErrors({
        submit: 'Failed to create page. Please try again.',
      });
    }
  };

  const handleClose = () => {
    setTitle('');
    setParentGuid(currentPageGuid || null);
    setIsRootPage(false);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="create-page-title"
        aria-modal="true"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="create-page-title" className="text-2xl font-bold text-gray-900 dark:text-white">
            Create Page from Link
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            This will create a new page for the broken link: <strong>{linkText}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title Input */}
          <div className="mb-4">
            <label htmlFor="page-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Page Title *
            </label>
            <input
              id="page-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`
                w-full px-3 py-2 border rounded-md 
                bg-white dark:bg-gray-700 
                text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              `}
              placeholder="Enter page title"
              autoFocus
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
            )}
          </div>

          {/* Root Page Checkbox */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isRootPage}
                onChange={(e) => {
                  setIsRootPage(e.target.checked);
                  if (e.target.checked) {
                    setParentGuid(null);
                  } else {
                    setParentGuid(currentPageGuid || null);
                  }
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Create as root page</span>
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Root pages appear at the top level of the page tree
            </p>
          </div>

          {/* Parent Selection (only shown if not root page) */}
          {!isRootPage && (
            <div className="mb-4">
              <label htmlFor="parent-page" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent Page
              </label>
              {currentPageGuid ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Will be created under the current page
                  </p>
                </div>
              ) : (
                <select
                  id="parent-page"
                  value={parentGuid || ''}
                  onChange={(e) => setParentGuid(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select parent page...</option>
                  {/* TODO: Load and display available parent pages */}
                </select>
              )}
              {errors.parent && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.parent}</p>
              )}
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md 
                hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPage.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors 
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPage.isPending ? 'Creating...' : 'Create Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
