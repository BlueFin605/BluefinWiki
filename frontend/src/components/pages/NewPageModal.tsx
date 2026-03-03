/**
 * NewPageModal Component
 * 
 * Modal for creating a new page with:
 * - Title input with validation
 * - Parent page selection (tree dropdown)
 * - Optional description field
 * - "Create as root page" checkbox
 */

import React, { useState } from 'react';
import { CreatePageRequest } from '../../types/page';
import { useCreatePage } from '../../hooks/usePages';

interface NewPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultParentGuid?: string | null;
}

export const NewPageModal: React.FC<NewPageModalProps> = ({
  isOpen,
  onClose,
  defaultParentGuid = null,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createPage = useCreatePage();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (title.trim().length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const request: CreatePageRequest = {
      title: title.trim(),
      parentGuid: defaultParentGuid,
      description: description.trim() || undefined,
      content: '# ' + title.trim() + '\n\nStart writing your page content here...',
    };

    try {
      await createPage.mutateAsync(request);
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
    setDescription('');
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
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="new-page-title"
        aria-modal="true"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="new-page-title" className="text-2xl font-bold text-gray-900">
            {defaultParentGuid ? 'Create Child Page' : 'Create New Page'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
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

        <form onSubmit={handleSubmit}>
          {/* Title Input */}
          <div className="mb-4">
            <label htmlFor="page-title" className="block text-sm font-medium text-gray-700 mb-1">
              Page Title *
            </label>
            <input
              id="page-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`
                w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${errors.title ? 'border-red-500' : 'border-gray-300'}
              `}
              placeholder="Enter page title"
              autoFocus
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Description Input */}
          <div className="mb-4">
            <label htmlFor="page-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="page-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of the page"
              rows={3}
            />
          </div>

          {/* Info about page location */}
          {defaultParentGuid && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                This page will be created as a child of the selected page.
              </p>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPage.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPage.isPending ? 'Creating...' : 'Create Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
