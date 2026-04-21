import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTypeDefinition, PageTypeProperty, PropertyType } from '../../types/page';
import {
  usePageTypes,
  useCreatePageType,
  useUpdatePageType,
  useDeletePageType,
} from '../../hooks/usePageTypes';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'tags', label: 'Tags' },
];

function parseDefault(type: PropertyType, raw: string): string | number | string[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  switch (type) {
    case 'number': {
      const n = Number(trimmed);
      return isNaN(n) ? undefined : n;
    }
    case 'tags':
      return trimmed.split(',').map(t => t.trim()).filter(Boolean);
    default:
      return trimmed;
  }
}

function formatDefault(prop: PageTypeProperty): string {
  if (prop.defaultValue === undefined || prop.defaultValue === null) return '';
  if (Array.isArray(prop.defaultValue)) return prop.defaultValue.join(', ');
  return String(prop.defaultValue);
}

// ============================================================================
// Property Schema Builder
// ============================================================================

const PropertySchemaBuilder: React.FC<{
  properties: PageTypeProperty[];
  onChange: (properties: PageTypeProperty[]) => void;
}> = ({ properties, onChange }) => {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PropertyType>('string');
  const [newRequired, setNewRequired] = useState(false);
  const [newDefault, setNewDefault] = useState('');

  const addProperty = () => {
    const kebabName = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!kebabName || properties.some(p => p.name === kebabName)) return;

    const defaultValue = parseDefault(newType, newDefault);
    onChange([...properties, {
      name: kebabName,
      type: newType,
      required: newRequired,
      ...(defaultValue !== undefined ? { defaultValue } : {}),
    }]);
    setNewName('');
    setNewType('string');
    setNewRequired(false);
    setNewDefault('');
  };

  const updateDefault = (index: number, raw: string) => {
    const updated = [...properties];
    const defaultValue = parseDefault(updated[index].type, raw);
    updated[index] = { ...updated[index], defaultValue };
    onChange(updated);
  };

  const removeProperty = (index: number) => {
    onChange(properties.filter((_, i) => i !== index));
  };

  const moveProperty = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= properties.length) return;
    const updated = [...properties];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Property Schema</label>

      {properties.map((prop, index) => (
        <div key={prop.name} className="bg-gray-50 rounded-sm p-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => moveProperty(index, -1)}
                disabled={index === 0}
                className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                ^
              </button>
              <button
                type="button"
                onClick={() => moveProperty(index, 1)}
                disabled={index === properties.length - 1}
                className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                v
              </button>
            </div>
            <span className="text-sm font-mono flex-1">{prop.name}</span>
            <span className="text-xs text-gray-500">{prop.type}</span>
            {prop.required && (
              <span className="text-xs bg-red-100 text-red-700 px-1 rounded-sm">required</span>
            )}
            <button
              type="button"
              onClick={() => removeProperty(index)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <span className="text-xs text-gray-400 shrink-0">Default:</span>
            <input
              type={prop.type === 'number' ? 'number' : 'text'}
              value={formatDefault(prop)}
              onChange={(e) => updateDefault(index, e.target.value)}
              placeholder={prop.type === 'tags' ? 'tag1, tag2, ...' : 'none'}
              className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>
      ))}

      <div className="space-y-2 mt-2 bg-blue-50 rounded-sm p-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Property name"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-sm"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProperty())}
            />
          </div>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as PropertyType)}
            className="px-2 py-1 text-sm border border-gray-300 rounded-sm"
          >
            {PROPERTY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={newRequired}
              onChange={(e) => setNewRequired(e.target.checked)}
            />
            Required
          </label>
          <button
            type="button"
            onClick={addProperty}
            disabled={!newName.trim()}
            className="px-2 py-1 text-sm bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">Default:</span>
          <input
            type={newType === 'number' ? 'number' : 'text'}
            value={newDefault}
            onChange={(e) => setNewDefault(e.target.value)}
            placeholder={newType === 'tags' ? 'tag1, tag2, ...' : 'none'}
            className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProperty())}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Page Type Form (Create / Edit)
// ============================================================================

const PageTypeForm: React.FC<{
  initial?: PageTypeDefinition;
  allTypes: PageTypeDefinition[];
  onSave: (data: {
    name: string;
    icon: string;
    properties: PageTypeProperty[];
    allowedChildTypes: string[];
    allowWikiPageChildren: boolean;
    allowedParentTypes: string[];
    allowAnyParent: boolean;
  }) => void;
  onCancel: () => void;
  saving?: boolean;
}> = ({ initial, allTypes, onSave, onCancel, saving }) => {
  const [name, setName] = useState(initial?.name || '');
  const [icon, setIcon] = useState(initial?.icon || '📄');
  const [properties, setProperties] = useState<PageTypeProperty[]>(initial?.properties || []);
  const [allowedChildTypes, setAllowedChildTypes] = useState<string[]>(initial?.allowedChildTypes || []);
  const [allowWikiPageChildren, setAllowWikiPageChildren] = useState(initial?.allowWikiPageChildren ?? true);
  const [allowedParentTypes, setAllowedParentTypes] = useState<string[]>(initial?.allowedParentTypes || []);
  const [allowAnyParent, setAllowAnyParent] = useState(initial?.allowAnyParent ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !icon.trim()) return;
    onSave({ name: name.trim(), icon: icon.trim(), properties, allowedChildTypes, allowWikiPageChildren, allowedParentTypes, allowAnyParent });
  };

  const toggleChildType = (guid: string) => {
    setAllowedChildTypes(prev =>
      prev.includes(guid) ? prev.filter(g => g !== guid) : [...prev, guid]
    );
  };

  const toggleParentType = (guid: string) => {
    setAllowedParentTypes(prev =>
      prev.includes(guid) ? prev.filter(g => g !== guid) : [...prev, guid]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-16 px-2 py-2 text-center text-2xl border border-gray-300 rounded-sm"
            maxLength={4}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. TV Show"
            autoFocus
          />
        </div>
      </div>

      <PropertySchemaBuilder properties={properties} onChange={setProperties} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Child Types</label>
        <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-sm p-2">
          {allTypes
            .filter(t => t.guid !== initial?.guid)
            .map(t => (
              <label key={t.guid} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowedChildTypes.includes(t.guid)}
                  onChange={() => toggleChildType(t.guid)}
                />
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </label>
            ))}
          {allTypes.filter(t => t.guid !== initial?.guid).length === 0 && (
            <p className="text-xs text-gray-500">No other types available yet.</p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allowWikiPageChildren}
          onChange={(e) => setAllowWikiPageChildren(e.target.checked)}
        />
        Allow untyped wiki pages as children
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Parent Types</label>
        <p className="text-xs text-gray-500 mb-1">Restrict which page types this type can be placed under. Leave all unchecked to allow any parent.</p>
        <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-sm p-2">
          {allTypes
            .filter(t => t.guid !== initial?.guid)
            .map(t => (
              <label key={t.guid} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowedParentTypes.includes(t.guid)}
                  onChange={() => toggleParentType(t.guid)}
                />
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </label>
            ))}
          {allTypes.filter(t => t.guid !== initial?.guid).length === 0 && (
            <p className="text-xs text-gray-500">No other types available yet.</p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allowAnyParent}
          onChange={(e) => setAllowAnyParent(e.target.checked)}
        />
        Allow placement under untyped wiki pages
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-sm hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : initial ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

// ============================================================================
// Main Admin Page
// ============================================================================

export const PageTypesAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { data: pageTypes = [], isLoading } = usePageTypes();
  const createPageType = useCreatePageType();
  const updatePageType = useUpdatePageType();
  const deletePageType = useDeletePageType();

  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<PageTypeDefinition | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleCreate = async (data: {
    name: string;
    icon: string;
    properties: PageTypeProperty[];
    allowedChildTypes: string[];
    allowWikiPageChildren: boolean;
    allowedParentTypes: string[];
    allowAnyParent: boolean;
  }) => {
    await createPageType.mutateAsync(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: {
    name: string;
    icon: string;
    properties: PageTypeProperty[];
    allowedChildTypes: string[];
    allowWikiPageChildren: boolean;
    allowedParentTypes: string[];
    allowAnyParent: boolean;
  }) => {
    if (!editingType) return;
    await updatePageType.mutateAsync({ guid: editingType.guid, ...data });
    setEditingType(null);
  };

  const handleDelete = async (guid: string) => {
    await deletePageType.mutateAsync(guid);
    setConfirmDelete(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-600">Loading page types...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              aria-label="Back to settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Page Types</h1>
          </div>
          {!showForm && !editingType && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700"
            >
              + New Type
            </button>
          )}
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Create Page Type</h2>
            <PageTypeForm
              allTypes={pageTypes}
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              saving={createPageType.isPending}
            />
          </div>
        )}

        {/* Edit Form */}
        {editingType && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Edit: {editingType.icon} {editingType.name}</h2>
            <PageTypeForm
              initial={editingType}
              allTypes={pageTypes}
              onSave={handleUpdate}
              onCancel={() => setEditingType(null)}
              saving={updatePageType.isPending}
            />
          </div>
        )}

        {/* Type List */}
        <div className="space-y-3">
          {pageTypes.map(pt => (
            <div key={pt.guid} className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
              <span className="text-2xl">{pt.icon}</span>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{pt.name}</h3>
                <p className="text-sm text-gray-500">
                  {pt.properties.length} properties
                  {pt.allowedChildTypes.length > 0 && ` | ${pt.allowedChildTypes.length} child types`}
                  {pt.allowedParentTypes.length > 0 && ` | ${pt.allowedParentTypes.length} parent types`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingType(pt)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-sm"
                >
                  Edit
                </button>
                {confirmDelete === pt.guid ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-600">Delete?</span>
                    <button
                      onClick={() => handleDelete(pt.guid)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded-sm hover:bg-red-700"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-sm"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(pt.guid)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {pageTypes.length === 0 && !showForm && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">No page types defined yet</p>
              <p className="text-sm">Page types add structure to your wiki pages with custom schemas and hierarchy rules.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageTypesAdmin;
