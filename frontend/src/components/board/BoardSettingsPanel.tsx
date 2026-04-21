import React, { useState, useRef, useEffect } from 'react';
import { BoardConfig, PageTypeDefinition } from '../../types/page';

interface BoardSettingsPanelProps {
  config?: BoardConfig;
  boardableTypes: PageTypeDefinition[];
  currentColumns: string[];
  onSave: (config: BoardConfig) => void;
  onClose: () => void;
}

const COLOR_PALETTE = [
  '#6b7280', // gray
  '#3b82f6', // blue
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
];

export const BoardSettingsPanel: React.FC<BoardSettingsPanelProps> = ({
  config,
  boardableTypes,
  onSave,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const [targetTypeGuid, setTargetTypeGuid] = useState(config?.targetTypeGuid || '');
  const [showParentTitle, setShowParentTitle] = useState(config?.showParentTitle ?? true);
  const [swapTitles, setSwapTitles] = useState(config?.swapTitles ?? false);
  const [defaultView, setDefaultView] = useState(config?.defaultView ?? 'content');
  const [columns, setColumns] = useState<string[]>(config?.columns || []);
  const [colors, setColors] = useState<Record<string, string>>(config?.colors || {});
  const [newColumn, setNewColumn] = useState('');
  const [editingColor, setEditingColor] = useState<string | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleSave = () => {
    const newConfig: BoardConfig = {};
    if (columns.length > 0) newConfig.columns = columns;
    if (Object.keys(colors).length > 0) newConfig.colors = colors;
    if (targetTypeGuid) {
      newConfig.targetTypeGuid = targetTypeGuid;
      newConfig.depth = config?.depth || 10;
      newConfig.showParentTitle = showParentTitle;
      if (swapTitles) newConfig.swapTitles = true;
    }
    if (defaultView === 'board') newConfig.defaultView = 'board';
    onSave(newConfig);
  };

  const addColumn = () => {
    const name = newColumn.trim();
    if (name && !columns.includes(name)) {
      setColumns([...columns, name]);
      setNewColumn('');
    }
  };

  const removeColumn = (name: string) => {
    setColumns(columns.filter((c) => c !== name));
    const updated = { ...colors };
    delete updated[name];
    setColors(updated);
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    setColumns(next);
  };

  const setColumnColor = (colName: string, color: string) => {
    setColors({ ...colors, [colName]: color });
    setEditingColor(null);
  };

  const targetType = boardableTypes.find((pt) => pt.guid === targetTypeGuid);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Board Settings</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Target type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Show pages of type</label>
          <select
            className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-blue-400"
            value={targetTypeGuid}
            onChange={(e) => setTargetTypeGuid(e.target.value)}
          >
            <option value="">Direct children</option>
            {boardableTypes.map((pt) => (
              <option key={pt.guid} value={pt.guid}>
                {pt.icon} {pt.name}
              </option>
            ))}
          </select>
          {targetType && (
            <p className="text-xs text-gray-400 mt-1">
              Collects all {targetType.name} pages from descendants
            </p>
          )}
        </div>

        {/* Show parent title */}
        {targetTypeGuid && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showParentTitle}
                onChange={(e) => setShowParentTitle(e.target.checked)}
                className="rounded-sm border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              Show parent title on cards
            </label>
            {showParentTitle && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pl-6">
                <input
                  type="checkbox"
                  checked={swapTitles}
                  onChange={(e) => setSwapTitles(e.target.checked)}
                  className="rounded-sm border-gray-300 text-blue-600 focus:ring-blue-400"
                />
                Use parent as primary title
              </label>
            )}
          </div>
        )}

        {/* Default view */}
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={defaultView === 'board'}
            onChange={(e) => setDefaultView(e.target.checked ? 'board' : 'content')}
            className="rounded-sm border-gray-300 text-blue-600 focus:ring-blue-400"
          />
          Open in board view by default
        </label>

        {/* Columns */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Columns</label>
          {columns.length === 0 && (
            <p className="text-xs text-gray-400 mb-2">
              No columns configured — they will be derived from state values automatically.
            </p>
          )}
          <div className="space-y-1">
            {columns.map((col, i) => (
              <div key={col} className="flex items-center gap-1.5 group">
                {/* Color dot */}
                <div className="relative">
                  <button
                    className="w-5 h-5 rounded-full border border-gray-300 shrink-0"
                    style={{ backgroundColor: colors[col] || '#6b7280' }}
                    onClick={() => setEditingColor(editingColor === col ? null : col)}
                    title="Change color"
                  />
                  {editingColor === col && (
                    <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-1 z-10">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border border-gray-200 hover:scale-125 transition-transform"
                          style={{ backgroundColor: c }}
                          onClick={() => setColumnColor(col, c)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Column name */}
                <span className="text-sm text-gray-700 flex-1 truncate">{col}</span>

                {/* Reorder buttons */}
                <button
                  className="p-0.5 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100"
                  onClick={() => moveColumn(i, -1)}
                  disabled={i === 0}
                  title="Move up"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  className="p-0.5 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100"
                  onClick={() => moveColumn(i, 1)}
                  disabled={i === columns.length - 1}
                  title="Move down"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Remove */}
                <button
                  className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                  onClick={() => removeColumn(col)}
                  title="Remove column"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add column */}
          <div className="flex items-center gap-1.5 mt-2">
            <input
              type="text"
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addColumn(); }}
              placeholder="Add column..."
              className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={addColumn}
              disabled={!newColumn.trim()}
              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-sm disabled:opacity-30"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </div>
  );
};
