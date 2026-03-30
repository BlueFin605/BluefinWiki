import React, { useState } from 'react';
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

  const addProperty = () => {
    const kebabName = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!kebabName || properties.some(p => p.name === kebabName)) return;

    onChange([...properties, { name: kebabName, type: newType, required: newRequired }]);
    setNewName('');
    setNewType('string');
    setNewRequired(false);
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
        <div key={prop.name} className="flex items-center gap-2 bg-gray-50 rounded p-2">
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
            <span className="text-xs bg-red-100 text-red-700 px-1 rounded">required</span>
          )}
          <button
            type="button"
            onClick={() => removeProperty(index)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex items-end gap-2 mt-2">
        <div className="flex-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Property name"
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProperty())}
          />
        </div>
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as PropertyType)}
          className="px-2 py-1 text-sm border border-gray-300 rounded"
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
          className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
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
  }) => void;
  onCancel: () => void;
  saving?: boolean;
}> = ({ initial, allTypes, onSave, onCancel, saving }) => {
  const [name, setName] = useState(initial?.name || '');
  const [icon, setIcon] = useState(initial?.icon || '📄');
  const [properties, setProperties] = useState<PageTypeProperty[]>(initial?.properties || []);
  const [allowedChildTypes, setAllowedChildTypes] = useState<string[]>(initial?.allowedChildTypes || []);
  const [allowWikiPageChildren, setAllowWikiPageChildren] = useState(initial?.allowWikiPageChildren ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !icon.trim()) return;
    onSave({ name: name.trim(), icon: icon.trim(), properties, allowedChildTypes, allowWikiPageChildren });
  };

  const toggleChildType = (guid: string) => {
    setAllowedChildTypes(prev =>
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
            className="w-16 px-2 py-2 text-center text-2xl border border-gray-300 rounded"
            maxLength={4}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. TV Show"
            autoFocus
          />
        </div>
      </div>

      <PropertySchemaBuilder properties={properties} onChange={setProperties} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Child Types</label>
        <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
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

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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
          <h1 className="text-2xl font-bold text-gray-900">Page Types</h1>
          {!showForm && !editingType && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + New Type
            </button>
          )}
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
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
          <div className="bg-white rounded-lg shadow p-6 mb-6">
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
            <div key={pt.guid} className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
              <span className="text-2xl">{pt.icon}</span>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{pt.name}</h3>
                <p className="text-sm text-gray-500">
                  {pt.properties.length} properties
                  {pt.allowedChildTypes.length > 0 && ` | ${pt.allowedChildTypes.length} child types`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingType(pt)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  Edit
                </button>
                {confirmDelete === pt.guid ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-600">Delete?</span>
                    <button
                      onClick={() => handleDelete(pt.guid)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(pt.guid)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
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
