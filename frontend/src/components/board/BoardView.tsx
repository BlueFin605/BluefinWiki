import React, { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BoardColumn, CardDropPosition } from './BoardColumn';
import { CardSummaryDialog } from './CardSummaryDialog';
import { usePageChildrenWithProperties, useReorderPages } from '../../hooks/usePages';
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
  const { data: children = [], isLoading, error } = usePageChildrenWithProperties(parentGuid, deepFetchOptions);
  const { data: pageTypesList = [] } = usePageTypes();
  const queryClient = useQueryClient();
  const reorderPages = useReorderPages();

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

    // Sort cards within each column by sortOrder (ascending), then modifiedAt (most recent first)
    for (const state of Object.keys(byState)) {
      byState[state].sort((a, b) => {
        const aHasOrder = a.sortOrder !== undefined;
        const bHasOrder = b.sortOrder !== undefined;
        if (aHasOrder && bHasOrder) return a.sortOrder! - b.sortOrder!;
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
      const queryKey = [
        'pages', 'children', parentGuid, 'with-properties',
        boardConfig?.targetTypeGuid ?? null,
        deepFetchOptions?.depth ?? null,
      ];
      const previousData = queryClient.getQueryData<PageChildDetail[]>(queryKey);

      queryClient.setQueryData<PageChildDetail[]>(queryKey, (old) =>
        old?.map((c) =>
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
        queryClient.setQueryData(queryKey, previousData);
        setToast('Failed to update state. Please try again.');
        setTimeout(() => setToast(null), 3000);
      }
    },
    [draggedGuid, children, parentGuid, queryClient]
  );

  // Within-column card reorder
  const handleCardReorder = useCallback(
    async (columnState: string, targetGuid: string, position: CardDropPosition) => {
      console.log('[board-reorder] handleCardReorder called:', {
        columnState, targetGuid, position, draggedGuid,
      });

      if (!draggedGuid || draggedGuid === targetGuid) {
        setDraggedGuid(null);
        return;
      }

      const card = children.find((c) => c.guid === draggedGuid);
      if (!card) {
        console.warn('[board-reorder] Dragged card not found in children');
        return;
      }

      const currentState = typeof card.properties?.state?.value === 'string'
        ? card.properties.state.value
        : UNCATEGORISED;

      console.log('[board-reorder] State check:', { currentState, columnState, sameColumn: currentState === columnState });

      // If card is from a different column, this is a state change + position
      if (currentState !== columnState) {
        // Change state first, then reorder
        const queryKey = [
          'pages', 'children', parentGuid, 'with-properties',
          boardConfig?.targetTypeGuid ?? null,
          deepFetchOptions?.depth ?? null,
        ];
        const previousData = queryClient.getQueryData<PageChildDetail[]>(queryKey);

        // Optimistic state change
        queryClient.setQueryData<PageChildDetail[]>(queryKey, (old) =>
          old?.map((c) =>
            c.guid === draggedGuid
              ? {
                  ...c,
                  properties: {
                    ...c.properties,
                    state: { type: 'string' as const, value: columnState },
                  },
                }
              : c
          )
        );

        setDraggedGuid(null);

        try {
          const updateRequest: UpdatePageRequest = {
            properties: {
              ...(card.properties || {}),
              state: { type: 'string', value: columnState },
            },
          };
          await apiClient.put(`/pages/${draggedGuid}`, updateRequest);
          queryClient.invalidateQueries({ queryKey: ['pages', 'children', parentGuid] });
        } catch {
          queryClient.setQueryData(queryKey, previousData);
          setToast('Failed to update state. Please try again.');
          setTimeout(() => setToast(null), 3000);
        }
        return;
      }

      // Same column — reorder
      // Build the new visual order for cards in this column
      const columnCards = cardsByColumn[columnState] || [];
      const reorderedCards = columnCards.filter(c => c.guid !== draggedGuid);
      const targetIndex = reorderedCards.findIndex(c => c.guid === targetGuid);
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      const draggedCard = columnCards.find(c => c.guid === draggedGuid);
      if (draggedCard) {
        reorderedCards.splice(insertIndex, 0, draggedCard);
      }

      // Group reordered cards by their actual parent — each group is a
      // separate reorder call because siblings must share a parent.
      // For non-deep boards all cards share parentGuid; for deep boards
      // cards may come from different parents.
      const byParent = new Map<string, string[]>();
      for (const c of reorderedCards) {
        const pGuid = c.parentGuid ?? '__root__';
        if (!byParent.has(pGuid)) byParent.set(pGuid, []);
        byParent.get(pGuid)!.push(c.guid);
      }

      // Optimistic reorder in cache
      const queryKey = [
        'pages', 'children', parentGuid, 'with-properties',
        boardConfig?.targetTypeGuid ?? null,
        deepFetchOptions?.depth ?? null,
      ];
      const previousData = queryClient.getQueryData<PageChildDetail[]>(queryKey);

      // Update sortOrder optimistically based on new visual position
      queryClient.setQueryData<PageChildDetail[]>(queryKey, (old) => {
        if (!old) return old;
        const updated = [...old];
        for (let i = 0; i < reorderedCards.length; i++) {
          const idx = updated.findIndex(c => c.guid === reorderedCards[i].guid);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], sortOrder: i * 1000 };
          }
        }
        return updated;
      });

      setDraggedGuid(null);

      try {
        // Send one reorder request per parent group (skip single-card groups — nothing to reorder)
        const reorderRequests = Array.from(byParent.entries())
          .filter(([, guids]) => guids.length >= 2)
          .map(([pGuid, guids]) => ({
            parentGuid: pGuid === '__root__' ? null : pGuid,
            orderedGuids: guids,
          }));
        if (reorderRequests.length > 0) {
          console.log('[board-reorder] Sending reorder requests:', reorderRequests);
          await Promise.all(reorderRequests.map(req => reorderPages.mutateAsync(req)));
        }
        queryClient.invalidateQueries({ queryKey: ['pages', 'children', parentGuid] });
      } catch (err) {
        console.error('[board-reorder] Reorder failed:', err);
        queryClient.setQueryData(queryKey, previousData);
        setToast('Failed to reorder cards. Please try again.');
        setTimeout(() => setToast(null), 3000);
      }
    },
    [draggedGuid, children, cardsByColumn, parentGuid, queryClient, reorderPages, boardConfig, deepFetchOptions]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Failed to load board</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['pages', 'children', parentGuid] })}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
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
