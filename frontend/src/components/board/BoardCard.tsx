import React from 'react';
import { PageChildDetail, PageTypeDefinition } from '../../types/page';

interface BoardCardProps {
  card: PageChildDetail;
  pageType?: PageTypeDefinition;
  onNavigate: (guid: string) => void;
  onDragStart: (e: React.DragEvent, guid: string) => void;
}

/** Max number of properties to show on a card */
const MAX_DISPLAY_PROPERTIES = 3;

export const BoardCard: React.FC<BoardCardProps> = ({
  card,
  pageType,
  onNavigate,
  onDragStart,
}) => {
  // Collect display properties (exclude 'state' since it's shown by column)
  const displayProperties = card.properties
    ? Object.entries(card.properties)
        .filter(([name]) => name !== 'state')
        .slice(0, MAX_DISPLAY_PROPERTIES)
    : [];

  const formatValue = (value: string | number | string[]): string => {
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
      draggable
      onDragStart={(e) => onDragStart(e, card.guid)}
      onClick={() => onNavigate(card.guid)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onNavigate(card.guid); }}
    >
      {/* Type icon + title */}
      <div className="flex items-start gap-2">
        {pageType && (
          <span className="text-base shrink-0 mt-0.5" title={pageType.name}>
            {pageType.icon}
          </span>
        )}
        <span className="font-medium text-sm text-gray-900 leading-tight line-clamp-2">
          {card.title}
        </span>
      </div>

      {/* Key properties */}
      {displayProperties.length > 0 && (
        <div className="mt-2 space-y-1">
          {displayProperties.map(([name, prop]) => (
            <div key={name} className="flex items-center gap-1 text-xs text-gray-500">
              <span className="text-gray-400 truncate max-w-[80px]">{name}:</span>
              <span className="text-gray-600 truncate">{formatValue(prop.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
