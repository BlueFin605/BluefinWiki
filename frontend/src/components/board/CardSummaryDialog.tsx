import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageChildDetail, PageTypeDefinition, PageProperty, PropertyType } from '../../types/page';
import { apiClient } from '../../config/api';
import { useTags } from '../../hooks/useTags';

const TagPropertyInput: React.FC<{
  propertyName: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}> = ({ propertyName, tags, onChange }) => {
  const { data: vocabularyTags } = useTags(propertyName);
  const [input, setInput] = useState('');

  const suggestions = input
    ? (vocabularyTags?.filter((t) => !tags.includes(t.tag) && t.tag.includes(input.toLowerCase())).slice(0, 5) ?? [])
    : [];

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().trim();
    if (normalized && !tags.includes(normalized)) {
      onChange([...tags, normalized]);
    }
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-800 text-xs rounded"
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-0.5 hover:text-purple-600"
              aria-label={`Remove ${tag}`}
            >
              x
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(input);
            }
          }}
          placeholder="Add tag..."
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-32 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.tag}
                onClick={() => addTag(s.tag)}
                className="block w-full text-left px-2 py-1 text-sm hover:bg-blue-50"
              >
                {s.tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface CardSummaryDialogProps {
  card: PageChildDetail | null;
  pageType?: PageTypeDefinition;
  onClose: () => void;
  parentGuid: string;
}

export const CardSummaryDialog: React.FC<CardSummaryDialogProps> = ({
  card,
  pageType,
  onClose,
  parentGuid,
}) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [properties, setProperties] = useState<Record<string, PageProperty>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when card changes
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setProperties(card.properties ? { ...card.properties } : {});
      setError(null);
    }
  }, [card]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (card) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [card, handleKeyDown]);

  if (!card) return null;

  const hasChanges =
    title !== card.title ||
    JSON.stringify(properties) !== JSON.stringify(card.properties ?? {});

  const handlePropertyChange = (name: string, value: string | number | string[]) => {
    setProperties((prev) => {
      const existing = prev[name];
      if (existing) {
        return { ...prev, [name]: { ...existing, value } };
      }
      // Property from type definition not yet in saved properties — resolve its type
      const typeProp = pageType?.properties.find((p) => p.name === name);
      const type: PropertyType = typeProp?.type ?? (Array.isArray(value) ? 'tags' : typeof value === 'number' ? 'number' : 'string');
      return { ...prev, [name]: { type, value } };
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Merge type-defined defaults into properties so new fields are saved
      const mergedProps: Record<string, PageProperty> = { ...properties };
      if (pageType) {
        for (const ptProp of pageType.properties) {
          if (!mergedProps[ptProp.name]) {
            mergedProps[ptProp.name] = {
              type: ptProp.type,
              value: ptProp.defaultValue ?? (ptProp.type === 'tags' ? [] : ptProp.type === 'number' ? 0 : ''),
            };
          }
        }
      }
      await apiClient.put(`/pages/${card.guid}`, {
        title: title.trim(),
        properties: mergedProps,
      });
      queryClient.invalidateQueries({ queryKey: ['pages', 'children', parentGuid] });
      queryClient.invalidateQueries({ queryKey: ['pages', 'detail', card.guid] });
      onClose();
    } catch {
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(`/pages/${card.guid}`, '_blank');
  };

  // Build ordered property list: type-defined properties first, then extras
  const propertyEntries: Array<{ name: string; type: PropertyType; value: string | number | string[] }> = [];
  const seen = new Set<string>();
  if (pageType) {
    for (const ptProp of pageType.properties) {
      const current = properties[ptProp.name];
      propertyEntries.push({
        name: ptProp.name,
        type: ptProp.type,
        value: current?.value ?? ptProp.defaultValue ?? (ptProp.type === 'tags' ? [] : ''),
      });
      seen.add(ptProp.name);
    }
  }
  // Extra properties beyond the type definition (or all properties if no type)
  for (const [name, prop] of Object.entries(properties)) {
    if (!seen.has(name)) {
      propertyEntries.push({ name, type: prop.type, value: prop.value });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="card-summary-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          {pageType && (
            <span className="text-xl shrink-0" title={pageType.name}>
              {pageType.icon}
            </span>
          )}
          <input
            id="card-summary-title"
            className="flex-1 text-lg font-semibold text-gray-900 border-0 border-b-2 border-transparent focus:border-blue-500 focus:outline-none bg-transparent px-1 py-0.5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
          />
        </div>

        {card.parentTitle && (
          <div className="px-5 text-xs text-gray-400 -mt-1 mb-2">in {card.parentTitle}</div>
        )}

        {/* Properties */}
        {propertyEntries.length > 0 && (
          <div className="px-5 pb-2 space-y-3">
            {propertyEntries.map(({ name, type, value }) => (
              <div key={name} className="flex items-start gap-3">
                <label className="text-sm text-gray-500 w-24 shrink-0 pt-1.5 text-right">
                  {name}
                </label>
                <div className="flex-1">
                  {type === 'tags' ? (
                    <TagPropertyInput
                      propertyName={name}
                      tags={Array.isArray(value) ? value : []}
                      onChange={(tags) => handlePropertyChange(name, tags)}
                    />
                  ) : type === 'number' ? (
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      value={value as number}
                      onChange={(e) =>
                        handlePropertyChange(name, e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  ) : type === 'date' ? (
                    <input
                      type="date"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      value={String(value)}
                      onChange={(e) => handlePropertyChange(name, e.target.value)}
                    />
                  ) : (
                    <input
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      value={String(value)}
                      onChange={(e) => handlePropertyChange(name, e.target.value)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-5 py-2 text-sm text-red-600">{error}</div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 mt-2">
          <button
            onClick={handleOpenInNewTab}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open full editor
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                saving || !hasChanges
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
