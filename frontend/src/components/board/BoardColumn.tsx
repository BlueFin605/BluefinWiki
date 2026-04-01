import React, { useState, useRef, useCallback } from 'react';
import { PageChildDetail, PageTypeDefinition } from '../../types/page';
import { BoardCard } from './BoardCard';

export type CardDropPosition = 'before' | 'after';

export interface CardDropTarget {
  guid: string;
  position: CardDropPosition;
}

interface BoardColumnProps {
  name: string;
  color: string;
  cards: PageChildDetail[];
  pageTypes: Record<string, PageTypeDefinition>;
  swapTitles?: boolean;
  onCardClick: (card: PageChildDetail) => void;
  onCardDragStart: (e: React.DragEvent, guid: string) => void;
  onCardDrop: (columnState: string) => void;
  onCardReorder?: (columnState: string, targetGuid: string, position: CardDropPosition) => void;
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
  onCardReorder,
  onAddCard,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropTarget, setDropTarget] = useState<CardDropTarget | null>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  // Determine which card the cursor is closest to during drag
  const computeDropTarget = useCallback((e: React.DragEvent): CardDropTarget | null => {
    if (!cardsContainerRef.current || cards.length === 0) return null;

    const cardElements = cardsContainerRef.current.querySelectorAll('[data-card-guid]');
    let closestGuid: string | null = null;
    let closestPosition: CardDropPosition = 'after';
    let closestDistance = Infinity;

    for (const el of cardElements) {
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const distance = Math.abs(e.clientY - midY);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestGuid = el.getAttribute('data-card-guid');
        closestPosition = e.clientY < midY ? 'before' : 'after';
      }
    }

    if (!closestGuid) return null;
    return { guid: closestGuid, position: closestPosition };
  }, [cards]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
    setDropTarget(computeDropTarget(e));
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const target = computeDropTarget(e);
    setIsDragOver(false);
    setDropTarget(null);

    // If we have a precise card target and a reorder handler, use reorder
    if (target && onCardReorder) {
      onCardReorder(name, target.guid, target.position);
    } else {
      // Fallback: column-level drop (cross-column state change)
      onCardDrop(name);
    }
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
      <div ref={cardsContainerRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        {cards.map((card) => (
          <BoardCard
            key={card.guid}
            card={card}
            pageType={card.pageType ? pageTypes[card.pageType] : undefined}
            swapTitles={swapTitles}
            onCardClick={onCardClick}
            onDragStart={onCardDragStart}
            dropIndicator={
              dropTarget?.guid === card.guid ? dropTarget.position : null
            }
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
