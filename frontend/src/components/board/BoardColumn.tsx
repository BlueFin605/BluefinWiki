import React, { useState } from 'react';
import { PageChildDetail, PageTypeDefinition } from '../../types/page';
import { BoardCard } from './BoardCard';

interface BoardColumnProps {
  name: string;
  color: string;
  cards: PageChildDetail[];
  pageTypes: Record<string, PageTypeDefinition>;
  swapTitles?: boolean;
  onCardClick: (card: PageChildDetail) => void;
  onCardDragStart: (e: React.DragEvent, guid: string) => void;
  onCardDrop: (columnState: string) => void;
  onAddCard?: (state: string) => void;
}

const DEFAULT_COLOR = '#6b7280'; // gray-500

export const BoardColumn: React.FC<BoardColumnProps> = ({
  name,
  color,
  cards,
  pageTypes,
  swapTitles,
  onCardClick,
  onCardDragStart,
  onCardDrop,
  onAddCard,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only count as leave if we actually left the column (not a child element)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onCardDrop(name);
  };

  const resolvedColor = color || DEFAULT_COLOR;

  return (
    <div
      className={`flex flex-col bg-gray-50 rounded-lg min-w-[280px] max-w-[320px] shrink-0 ${
        isDragOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: resolvedColor }}
        />
        <h3 className="text-sm font-semibold text-gray-700 truncate">{name}</h3>
        <span className="ml-auto text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        {cards.map((card) => (
          <BoardCard
            key={card.guid}
            card={card}
            pageType={card.pageType ? pageTypes[card.pageType] : undefined}
            swapTitles={swapTitles}
            onCardClick={onCardClick}
            onDragStart={onCardDragStart}
          />
        ))}

        {/* Empty state */}
        {cards.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-6">
            No items
          </div>
        )}
      </div>

      {/* Add card button */}
      {onAddCard && (
        <button
          className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors border-t border-gray-200"
          onClick={() => onAddCard(name)}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      )}
    </div>
  );
};
