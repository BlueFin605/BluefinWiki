---
description: Plan for page reordering — drag-to-reorder in page tree sidebar and within board columns
tags: [bluefinwiki, plan, reorder, drag-drop, sort-order, board-order]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Page Reordering

Implements: [Design](../design.md) — Page hierarchy, Board view
Relates to: [Kanban Board](kanban/kanban-board.md) — within-column card ordering

## Scope

**Covers:**
- Two independent ordering fields: `sortOrder` (page tree) and `boardOrder` (board columns)
- `PUT /pages/reorder` endpoint for batch sibling reorder in the tree
- Gap-based `boardOrder` via `PUT /pages/{guid}` for single-card board reorder
- Drag-to-reorder in the page tree sidebar (between siblings at the same level)
- Drag-to-reorder cards within a board column
- New pages receive a sortOrder that places them at the end of their siblings

**Does not cover:**
- Drag-to-reparent (already implemented in PageTree)
- Drag between board columns (already implemented — changes `state` property)
- Sortable columns or column reordering on the board (already in BoardSettingsPanel)

## North Star

A family member should be able to control the order of pages in the sidebar tree and cards on a board by dragging them to the desired position. The order persists across sessions and is shared with all users. Reordering in one view does not affect the other.

## The Problem

Pages in the tree and cards on a board serve different purposes. The tree reflects hierarchical organisation (shows under TV Tracker). A board groups cards by state across potentially different parents (all "Completed" seasons from all shows). A single sort order cannot serve both views — reordering a card in a board column should not shuffle pages in the tree sidebar, and vice versa.

## Data Model

### Two Sort Order Fields

| Field | Stored in | Controls | Scope |
|-------|-----------|----------|-------|
| `sortOrder` | YAML frontmatter | Position in page tree among siblings | Per-parent (sibling pages) |
| `boardOrder` | YAML frontmatter | Position within a board column | Per-state value (within a column) |

Both are optional integers. Pages/cards without a value sort after ordered ones.

### sortOrder (Page Tree)

- Integer field in YAML frontmatter: `sortOrder: 0`
- Controls position among siblings (pages with the same parent)
- Lower values sort first
- Pages without `sortOrder` sort after all ordered pages, then by title alphabetically
- Set by the `PUT /pages/reorder` endpoint (batch operation)
- New pages receive `sortOrder = max sibling sortOrder + 1000`

### boardOrder (Board Columns)

- Integer field in YAML frontmatter: `boardOrder: 0`
- Controls position within a board column (cards sharing the same `state` value)
- Lower values sort first — works across parents on deep boards
- Cards without `boardOrder` sort after ordered cards, then by `modifiedAt` descending
- Set by `PUT /pages/{guid}` with `{ boardOrder: <number> }` (single-card update)

### Gap-Based Insertion for boardOrder

When dragging a card to a new position in a column, the frontend computes the new `boardOrder` from the neighbours:

```
dropped at top of column     → boardOrder = firstCard.boardOrder - 1000
dropped at bottom of column  → boardOrder = lastCard.boardOrder + 1000
dropped between cards A & B  → boardOrder = floor((A.boardOrder + B.boardOrder) / 2)
gap too small (B - A < 2)    → renumber entire column (0, 1000, 2000...)
```

Only the dragged card is saved in the common case (one API call). Renumbering is a rare fallback that updates all cards in the column.

### Reorder Endpoint (Page Tree)

```
PUT /pages/reorder
Body: { parentGuid: string | null, orderedGuids: string[] }
```

- `parentGuid` — the shared parent of all pages being reordered (`null` for root-level)
- `orderedGuids` — ordered list of sibling GUIDs in desired order
- Backend assigns `sortOrder = index * 1000` to each page
- Validates all GUIDs are actual children of `parentGuid`
- Returns `200 OK` with `{ updated: number }`

## Done Criteria

### Backend

- `sortOrder` and `boardOrder` fields parsed from and serialised to YAML frontmatter in S3StoragePlugin
- `listChildren()` sorts by `sortOrder` ascending, then by `title` ascending for ties
- `listChildren()` includes `boardOrder` in response for board views
- `pages-create` assigns `sortOrder` = (max sibling sortOrder + 1000) for new pages
- `PUT /pages/reorder` endpoint validates and persists tree order
- `PUT /pages/{guid}` accepts `boardOrder` field for board card positioning
- Both endpoints require authentication

### Page Tree (Frontend)

- Dragging a page between siblings at the same level triggers a reorder (not a reparent)
- Drop indicator (horizontal line) appears between items to show insertion point
- Dragging onto a page (existing behaviour) still reparents
- After reorder, tree reflects new order immediately via query invalidation
- Uses `sortOrder` — does not affect `boardOrder`

### Board View (Frontend)

- Cards within a column can be dragged up/down to reorder
- Drop indicator appears between cards to show insertion point
- Single `PUT /pages/{guid}` with computed `boardOrder` — one API call per drag
- Cross-column drag sets both `state` property and `boardOrder` in one call
- Optimistic update with revert on failure
- Uses `boardOrder` — does not affect `sortOrder`

### Types

- `PageSummary` and `PageContent` gain `sortOrder?: number` and `boardOrder?: number`
- `UpdatePageRequest` gains `boardOrder?: number`
- `ReorderRequest` type: `{ parentGuid: string | null, orderedGuids: string[] }`

## Constraints

- **Two independent orders** — `sortOrder` and `boardOrder` are completely independent. Changing one never affects the other.
- **No per-user ordering** — both sort orders are global, shared across all users.
- **Gap-based boardOrder** — gaps of 1000 between values. Renumber when gaps exhaust (rare).
- **Existing pages** — pages created before this feature have neither field. They sort after ordered items, by title (tree) or modifiedAt (board).

## Error Policy

- Reorder endpoint failure: frontend refetches to get actual state
- Board reorder failure: revert optimistic cache update, show toast
- Renumber failure: partial state possible — next refetch corrects the view

## References

- [Design](../design.md) — Data model, page frontmatter format
- [Kanban Board](kanban/kanban-board.md) — Board view, card ordering mention
