import React, { useState, useEffect, useCallback } from 'react';

export interface PageMetadata {
  title: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  description?: string;
  createdBy: string;
  modifiedBy: string;
  createdAt: string;
  modifiedAt: string;
  guid?: string;
}

interface PagePropertiesPanelProps {
  metadata: PageMetadata;
  onMetadataChange: (metadata: Partial<PageMetadata>) => void;
  editable?: boolean;
  onTitleChange?: (title: string) => void;
}

/**
 * Page Properties Panel Component
 * 
 * Displays and allows editing of page metadata including:
 * - Title (inline editing with H1 sync)
 * - Tags (multi-select input with autocomplete)
 * - Status (Draft, Published, Archived)
 * - Author (read-only)
 * - Created/modified timestamps (read-only)
 * 
 * Features:
 * - Inline title editing
 * - Tag input with comma/enter to add
 * - Status dropdown with visual indicators
 * - Read-only display of author and timestamps
 */
export const PagePropertiesPanel: React.FC<PagePropertiesPanelProps> = ({
  metadata,
  onMetadataChange,
  editable = true,
  onTitleChange,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(metadata.title);
  const [tagInput, setTagInput] = useState('');
  const [localTags, setLocalTags] = useState<string[]>(metadata.tags || []);
  const [localStatus, setLocalStatus] = useState(metadata.status);

  // Sync local state with prop changes
  useEffect(() => {
    setTitleValue(metadata.title);
    setLocalTags(metadata.tags || []);
    setLocalStatus(metadata.status);
  }, [metadata]);

  const handleTitleEdit = useCallback(() => {
    if (editable) {
      setIsEditingTitle(true);
    }
  }, [editable]);

  const handleTitleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTitleValue(newValue);
    if (newValue.trim()) {
      onMetadataChange({ title: newValue.trim() });
      if (onTitleChange) {
        onTitleChange(newValue.trim());
      }
    }
  }, [onMetadataChange, onTitleChange]);

  const handleTitleSave = useCallback(() => {
    setIsEditingTitle(false);
    if (!titleValue.trim()) {
      setTitleValue(metadata.title); // Reset if empty
      onMetadataChange({ title: metadata.title });
    }
  }, [titleValue, metadata.title, onMetadataChange]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitleValue(metadata.title);
      setIsEditingTitle(false);
    }
  }, [metadata.title, handleTitleSave]);

  const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !localTags.includes(newTag)) {
        const updatedTags = [...localTags, newTag];
        setLocalTags(updatedTags);
        onMetadataChange({ tags: updatedTags });
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && localTags.length > 0) {
      // Remove last tag when backspace on empty input
      const updatedTags = localTags.slice(0, -1);
      setLocalTags(updatedTags);
      onMetadataChange({ tags: updatedTags });
    }
  }, [tagInput, localTags, onMetadataChange]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const updatedTags = localTags.filter(tag => tag !== tagToRemove);
    setLocalTags(updatedTags);
    onMetadataChange({ tags: updatedTags });
  }, [localTags, onMetadataChange]);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as 'published' | 'archived';
    setLocalStatus(newStatus);
    onMetadataChange({ status: newStatus });
  }, [onMetadataChange]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'published':
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
  };

  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Page Properties
        </h3>
      </div>

      {/* Title Editing */}
      <div>
        <label 
          htmlFor="page-title-input"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Title
        </label>
        {isEditingTitle && editable ? (
          <input
            id="page-title-input"
            type="text"
            value={titleValue}
            onChange={handleTitleInputChange}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="w-full px-3 py-2 border border-blue-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
            autoFocus
          />
        ) : (
          <div
            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 ${
              editable ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'
            }`}
            onClick={handleTitleEdit}
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            onKeyDown={editable ? (e) => e.key === 'Enter' && handleTitleEdit() : undefined}
          >
            {titleValue || 'Untitled'}
          </div>
        )}
        {editable && !isEditingTitle && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Click to edit title
          </p>
        )}
      </div>

      {/* Tags Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {localTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-sm rounded"
            >
              {tag}
              {editable && (
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {editable && (
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            placeholder="Add tags (press Enter or comma)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          />
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {editable 
            ? 'Type and press Enter or comma to add tags. Backspace on empty field removes last tag.'
            : 'Tags help organize and find pages'
          }
        </p>
      </div>

      {/* Status Dropdown */}
      <div>
        <label htmlFor="status-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Status
        </label>
        {editable ? (
          <select
            id="status-select"
            value={localStatus}
            onChange={handleStatusChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        ) : (
          <div className="flex items-center">
            <span className={`px-3 py-1 text-sm rounded-full ${getStatusBadgeClass(localStatus)}`}>
              {localStatus.charAt(0).toUpperCase() + localStatus.slice(1)}
            </span>
          </div>
        )}
        {localStatus === 'archived' && (
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            📦 Archived - Read-only, excluded from main navigation
          </p>
        )}
      </div>

      {/* Author Display (Read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Author
        </label>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>Created by: {metadata.createdBy}</p>
          <p>Modified by: {metadata.modifiedBy}</p>
        </div>
      </div>

      {/* Timestamps (Read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Timestamps
        </label>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p>Created: {formatTimestamp(metadata.createdAt)}</p>
          <p>Modified: {formatTimestamp(metadata.modifiedAt)}</p>
        </div>
      </div>

      {/* Page GUID (Read-only, for debugging) */}
      {metadata.guid && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Page ID
          </label>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
            {metadata.guid}
          </div>
        </div>
      )}
    </div>
  );
};

export default PagePropertiesPanel;
