import React, { useState, useCallback } from 'react';
import { PageProperty, PropertyType } from '../../types/page';
import { useTags } from '../../hooks/useTags';

interface CustomPropertiesEditorProps {
  properties: Record<string, PageProperty>;
  onChange: (properties: Record<string, PageProperty>) => void;
  editable?: boolean;
}

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'tags', label: 'Tags' },
];

function defaultValueForType(type: PropertyType): string | number | string[] {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'date': return new Date().toISOString().split('T')[0];
    case 'tags': return [];
  }
}

const PropertyValueInput: React.FC<{
  propertyName: string;
  prop: PageProperty;
  onValueChange: (value: string | number | string[]) => void;
  editable: boolean;
}> = ({ propertyName, prop, onValueChange, editable }) => {
  const { data: vocabularyTags } = useTags(propertyName);
  const [tagInput, setTagInput] = useState('');

  const inputClass = 'w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100';

  switch (prop.type) {
    case 'string':
      return (
        <input
          type="text"
          value={prop.value as string}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={!editable}
          className={inputClass}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={prop.value as number}
          onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
          disabled={!editable}
          step="any"
          className={inputClass}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={prop.value as string}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={!editable}
          className={inputClass}
        />
      );

    case 'tags': {
      const tags = (prop.value as string[]) || [];

      // Filter vocabulary for autocomplete suggestions
      const suggestions = vocabularyTags
        ?.filter(t => !tags.includes(t.tag) && t.tag.includes(tagInput.toLowerCase()))
        .slice(0, 5) || [];

      const addTag = (tag: string) => {
        const normalized = tag.toLowerCase().trim();
        if (normalized && !tags.includes(normalized)) {
          onValueChange([...tags, normalized]);
        }
        setTagInput('');
      };

      return (
        <div>
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs rounded"
              >
                {tag}
                {editable && (
                  <button
                    onClick={() => onValueChange(tags.filter(t => t !== tag))}
                    className="ml-0.5 hover:text-purple-600 dark:hover:text-purple-300"
                    aria-label={`Remove ${tag}`}
                  >
                    x
                  </button>
                )}
              </span>
            ))}
          </div>
          {editable && (
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Add tag..."
                className={inputClass}
              />
              {tagInput && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-32 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.tag}
                      onClick={() => addTag(s.tag)}
                      className="block w-full text-left px-2 py-1 text-sm hover:bg-blue-50 dark:hover:bg-gray-600 dark:text-gray-200"
                    >
                      {s.tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
  }
};

export const CustomPropertiesEditor: React.FC<CustomPropertiesEditorProps> = ({
  properties,
  onChange,
  editable = true,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PropertyType>('string');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const entries = Object.entries(properties);

  const handleValueChange = useCallback((name: string, value: string | number | string[]) => {
    onChange({ ...properties, [name]: { ...properties[name], value } });
  }, [properties, onChange]);

  const handleRemove = useCallback((name: string) => {
    const updated = { ...properties };
    delete updated[name];
    onChange(updated);
  }, [properties, onChange]);

  const handleAdd = useCallback(() => {
    const kebabName = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!kebabName || properties[kebabName]) return;

    onChange({
      ...properties,
      [kebabName]: { type: newType, value: defaultValueForType(newType) },
    });
    setNewName('');
    setNewType('string');
    setIsAdding(false);
  }, [newName, newType, properties, onChange]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between w-full text-left"
      >
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Custom Properties {entries.length > 0 && `(${entries.length})`}
        </h4>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="mt-3 space-y-3">
          {entries.map(([name, prop]) => (
            <div key={name} className="bg-gray-50 dark:bg-gray-900 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {name}
                  <span className="ml-1 text-gray-400 dark:text-gray-500">({prop.type})</span>
                </span>
                {editable && (
                  <button
                    onClick={() => handleRemove(name)}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    title={`Remove ${name}`}
                  >
                    Remove
                  </button>
                )}
              </div>
              <PropertyValueInput
                propertyName={name}
                prop={prop}
                onValueChange={(val) => handleValueChange(name, val)}
                editable={editable}
              />
            </div>
          ))}

          {entries.length === 0 && !isAdding && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No custom properties yet.
            </p>
          )}

          {editable && !isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add property
            </button>
          )}

          {isAdding && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Property name (e.g. rating)"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-100"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as PropertyType)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-100"
              >
                {PROPERTY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomPropertiesEditor;
