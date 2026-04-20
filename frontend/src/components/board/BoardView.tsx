import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BoardColumn, CardDropPosition } from './BoardColumn';
import { CardSummaryDialog } from './CardSummaryDialog';
import { usePageChildrenWithPropertiesPage } from '../../hooks/usePages';
import { usePageTypes } from '../../hooks/usePageTypes';
import { apiClient } from '../../config/api';
import {
  PageChildDetail,
  PageTypeDefinition,
  BoardConfig,
  UpdatePageRequest,
} from '../../types/page';

interface BoardViewProps {
  parentGuid: string;
  boardConfig?: BoardConfig;
  onNavigateToPage?: (guid: string) => void;
  onAddCard?: (state: string) => void;
}

const DEFAULT_COLORS: Record<string, string> = {
  Backlog: '#6b7280',
  'To Do': '#6b7280',
  'In Progress': '#3b82f6',
  Watching: '#3b82f6',
  Review: '#f59e0b',
  Done: '#22c55e',
  Completed: '#22c55e',
  Archived: '#9ca3af',
};

const UNCATEGORISED = 'Uncategorised';
const BOARD_PAGE_SIZE = 200;

function getColumnColor(name: string, configColors?: Record<string, string>): string {
  if (configColors?.[name]) return configColors[name];
  if (DEFAULT_COLORS[name]) return DEFAULT_COLORS[name];
  // Generate a consistent colour from the column name
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 50%)`;
}

export const BoardView: React.FC<BoardViewProps> = ({
  parentGuid,
  boardConfig,
  onAddCard,
}) => {
  // Deep fetch when boardConfig specifies a target type
  const deepFetchOptions = boardConfig?.targetTypeGuid
    ? { targetTypeGuid: boardConfig.targetTypeGuid, depth: boardConfig.depth ?? 10 }
    : undefined;
  const [cursor, setCursor] = useState<string | null>(null);
  const [children, setChildren] = useState<PageChildDetail[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const {
    data: childrenPage,
    isLoading,
    isFetching,
    error,
    refetch,
  } = usePageChildrenWithPropertiesPage(parentGuid, {
    ...deepFetchOptions,
    limit: BOARD_PAGE_SIZE,
    cursor,
  });

  useEffect(() => {
    setCursor(null);
    setChildren([]);
    setHasMore(false);
  }, [parentGuid, boardConfig?.targetTypeGuid, boardConfig?.depth]);

  useEffect(() => {
    if (!childrenPage) return;

    if (!cursor) {
      setChildren(childrenPage.children);
    } else {
      setChildren((prev) => {
        const byGuid = new Map(prev.map((item) => [item.guid, item]));
        for (const item of childrenPage.children) {
          byGuid.set(item.guid, item);
        }
        return Array.from(byGuid.values());
      });
    }

    setHasMore(Boolean(childrenPage.hasMore && childrenPage.nextCursor));
  }, [childrenPage, cursor]);

  const { data: pageTypesList = [] } = usePageTypes();
  const queryClient = useQueryClient();
  // Drag state
  const [draggedGuid, setDraggedGuid] = useState<string | null>(null);
  // Card summary dialog
  const [selectedCard, setSelectedCard] = useState<PageChildDetail | null>(null);
  // Toast notification for errors
  const [toast, setToast] = useState<string | null>(null);

  // Build page types lookup
  const pageTypesMap = useMemo(() => {
    const map: Record<string, PageTypeDefinition> = {};
    for (const pt of pageTypesList) map[pt.guid] = pt;
    return map;
  }, [pageTypesList]);

  // Group children into columns by their 'state' property
  const { columns, cardsByColumn } = useMemo(() => {
    const byState: Record<string, PageChildDetail[]> = {};

    for (const child of children) {
      const stateValue = child.properties?.state?.value;
      const state = typeof stateValue === 'string' ? stateValue : UNCATEGORISED;
      if (!byState[state]) byState[state] = [];
      byState[state].push(child);
    }

    // Sort cards within each column by boardOrder (ascending), then modifiedAt (most recent first)
    for (const state of Object.keys(byState)) {
      byState[state].sort((a, b) => {
        const aHasOrder = a.boardOrder !== undefined;
        const bHasOrder = b.boardOrder !== undefined;
        if (aHasOrder && bHasOrder) return a.boardOrder! - b.boardOrder!;
        if (aHasOrder && !bHasOrder) return -1;
        if (!aHasOrder && bHasOrder) return 1;
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      });
    }

    // Determine column order
    let orderedColumns: string[];
    if (boardConfig?.columns?.length) {
      // Configured columns first, then any unconfigured states alphabetically
      const configuredSet = new Set(boardConfig.columns);
      const unconfigured = Object.keys(byState)
        .filter((s) => !configuredSet.has(s) && s !== UNCATEGORISED)
        .sort();
      orderedColumns = [...boardConfig.columns, ...unconfigured];
    } else {
      // No config — alphabetical, with Uncategorised at the end
      orderedColumns = Object.keys(byState)
        .filter((s) => s !== UNCATEGORISED)
        .sort();
    }

    // Always include Uncategorised at the end if it has cards
    if (byState[UNCATEGORISED]?.length) {
      orderedColumns.push(UNCATEGORISED);
    }

    // Ensure all configured columns exist (even if empty)
    if (boardConfig?.columns) {
      for (const col of boardConfig.columns) {
        if (!byState[col]) byState[col] = [];
      }
    }

    return { columns: orderedColumns, cardsByColumn: byState };
  }, [children, boardConfig]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, guid: string) => {
    setDraggedGuid(guid);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', guid);
  }, []);

  const handleDrop = useCallback(
    async (targetState: string) => {
      console.log('[board-drop] Column-level handleDrop called:', { targetState, draggedGuid });
      if (!draggedGuid) return;

      const card = children.find((c) => c.guid === draggedGuid);
      if (!card) return;

      const currentState = typeof card.properties?.state?.value === 'string'
        ? card.properties.state.value
        : UNCATEGORISED;

      // No-op if dropping in same column (column-level drop = just state change)
      if (currentState === targetState) {
        setDraggedGuid(null);
        return;
      }

      // Optimistic update: patch the query cache
      const previousData = [...children];

      setChildren((old) =>
        old.map((c) =>
          c.guid === draggedGuid
            ? {
                ...c,
                properties: {
                  ...c.properties,
                  state: { type: 'string' as const, value: targetState },
                },
              }
            : c
        )
      );

      setDraggedGuid(null);

      // Persist the state change
      try {
        const updateRequest: UpdatePageRequest = {
          properties: {
            ...(card.properties || {}),
            state: { type: 'string', value: targetState },
          },
        };
        await apiClient.put(`/pages/${draggedGuid}`, updateRequest);
        // Invalidate to get fresh server data
        queryClient.invalidateQueries({ queryKey: ['pages', 'children', parentGuid] });
        queryClient.invalidateQueries({ queryKey: ['pages', 'detail', draggedGuid] });
      } catch {
        // Revert on failure
        setChildren(previousData);
        setToast('Failed to update state. Please try again.');
        setTimeout(() => setToast(null), 3000);
      }
    },
    [draggedGuid, children, parentGuid, queryClient]
  );

  // Compute a boardOrder for a card being inserted at a specific position
  // in the column. Uses gap-based insertion — only the dragged card is updated.
  const computeBoardOrder = useCallback(
    (columnCards: PageChildDetail[], targetGuid: string, position: CardDropPosition, draggedGuid: string): number => {
      // Build the list without the dragged card
      const others = columnCards.filter(c => c.guid !== draggedGuid);
      const targetIdx = others.findIndex(c => c.guid === targetGuid);
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;

      // Neighbours in the final order
      const prev = insertIdx > 0 ? others[insertIdx - 1] : null;
      const next = insertIdx < others.length ? others[insertIdx] : null;

      const prevOrder = prev?.boardOrder;
      const nextOrder = next?.boardOrder;

      if (prevOrder === undefined && nextOrder === undefined) {
        return 0; // only card
      }
      if (prevOrder === undefined) {
        return nextOrder! - 1000; // before first
      }
      if (nextOrder === undefined) {
        return prevOrder + 1000; // after last
      }
      // Between two cards
      const gap = nextOrder - prevOrder;
      if (gap >= 2) {
        return Math.floor((prevOrder + nextOrder) / 2);
      }
      // Gap exhausted — renumber entire column
      // Return a sentinel; caller will detect and renumber
      return -Infinity;
    },
    []
  );

  // Within-column card reorder (or cross-column with position)
  const handleCardReorder = useCallback(
    async (columnState: string, targetGuid: string, position: CardDropPosition) => {
      if (!draggedGuid || draggedGuid === targetGuid) {
        setDraggedGuid(null);
        return;
      }

      const card = children.find((c) => c.guid === draggedGuid);
      if (!card) return;

      const currentState = typeof card.properties?.state?.value === 'string'
        ? card.properties.state.value
        : UNCATEGORISED;

      const previousData = [...children];

      // Compute the new boardOrder for the dragged card
      const targetColumnCards = cardsByColumn[columnState] || [];
      let newBoardOrder = computeBoardOrder(targetColumnCards, targetGuid, position, draggedGuid);

      // If gap exhausted, renumber the entire column
      let renumberList: { guid: string; boardOrder: number }[] | null = null;
      if (newBoardOrder === -Infinity) {
        const others = targetColumnCards.filter(c => c.guid !== draggedGuid);
        const targetIdx = others.findIndex(c => c.guid === targetGuid);
        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
        others.splice(insertIdx, 0, card);
        renumberList = others.map((c, i) => ({ guid: c.guid, boardOrder: i * 1000 }));
        newBoardOrder = insertIdx * 1000;
      }

      // Build the update — may also include a state change for cross-column drops
      const updatePayload: UpdatePageRequest = { boardOrder: newBoardOrder };
      if (currentState !== columnState) {
        updatePayload.properties = {
          ...(card.properties || {}),
          state: { type: 'string', value: columnState },
        };
      }

      // Optimistic update
      setChildren((old) => {
        return old.map((c) => {
          if (c.guid === draggedGuid) {
            return {
              ...c,
              boardOrder: newBoardOrder,
              ...(currentState !== columnState
                ? { properties: { ...c.properties, state: { type: 'string' as const, value: columnState } } }
                : {}),
            };
          }
          // Apply renumber if needed
          if (renumberList) {
            const entry = renumberList.find(r => r.guid === c.guid);
            if (entry) return { ...c, boardOrder: entry.boardOrder };
          }
          return c;
        });
      });

      setDraggedGuid(null);

      try {
        // Single API call for the dragged card
        await apiClient.put(`/pages/${draggedGuid}`, updatePayload);

        // If we had to renumber, update the other cards too
        if (renumberList) {
          const otherUpdates = renumberList.filter(r => r.guid !== draggedGuid);
          await Promise.all(
            otherUpdates.map(r => apiClient.put(`/pages/${r.guid}`, { boardOrder: r.boardOrder }))
          );
        }

        queryClient.invalidateQueries({ queryKey: ['pages', 'children', parentGuid] });
      } catch {
        setChildren(previousData);
        setToast('Failed to reorder card. Please try again.');
        setTimeout(() => setToast(null), 3000);
      }
    },
    [draggedGuid, children, cardsByColumn, parentGuid, queryClient, computeBoardOrder]
  );

  const isInitialLoading = isLoading && children.length === 0;
  const isLoadingMore = isFetching && children.length > 0;

  const handleLoadMore = useCallback(() => {
    const nextCursor = childrenPage?.nextCursor;
    if (!nextCursor) return;
    setCursor(nextCursor);
  }, [childrenPage]);

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && children.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Failed to load board</p>
          <button
            onClick={() => {
              setCursor(null);
              void refetch();
            }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        No items to display on the board.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toast notification */}
      {toast && (
        <div className="absolute top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Horizontal scrolling board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full">
          {columns.map((colName) => (
            <BoardColumn
              key={colName}
              name={colName}
              color={getColumnColor(colName, boardConfig?.colors)}
              cards={cardsByColumn[colName] || []}
              pageTypes={pageTypesMap}
              swapTitles={boardConfig?.swapTitles}
              onCardClick={setSelectedCard}
              onCardDragStart={handleDragStart}
              onCardDrop={handleDrop}
              onCardReorder={handleCardReorder}
              onAddCard={onAddCard}
            />
          ))}
        </div>
      </div>

      {(hasMore || isLoadingMore) && (
        <div className="px-4 pb-4 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={!hasMore || isLoadingMore}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? 'Loading more...' : 'Load more cards'}
          </button>
        </div>
      )}

      {/* Card summary dialog */}
      <CardSummaryDialog
        card={selectedCard}
        pageType={selectedCard?.pageType ? pageTypesMap[selectedCard.pageType] : undefined}
        onClose={() => setSelectedCard(null)}
        parentGuid={parentGuid}
      />
    </div>
  );
};
