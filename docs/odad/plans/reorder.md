---
description: Plan for page reordering — drag-to-reorder in page tree sidebar and within board columns
tags: [bluefinwiki, plan, reorder, drag-drop, sort-order]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Page Reordering

Implements: [Design](../design.md) — Page hierarchy, Board view
Relates to: [Kanban Board](kanban/kanban-board.md) — within-column card ordering

## Scope

**Covers:**
- `sortOrder` integer field in page frontmatter for persistent sibling ordering
- Reorder API endpoint that accepts an ordered list of sibling GUIDs
- Drag-to-reorder in the page tree sidebar (between siblings at the same level)
- Drag-to-reorder cards within a board column
- New pages receive a sortOrder that places them at the end of their siblings

**Does not cover:**
- Drag-to-reparent (already implemented in PageTree)
- Drag between board columns (already implemented — changes `state` property)
- Sortable columns or column reordering on the board (already in BoardSettingsPanel)

## North Star

A family member should be able to control the order of pages in the sidebar tree and cards on a board by dragging them to the desired position. The order persists across sessions and is shared with all users.

## The Problem

Currently, pages in the tree are sorted by title (alphabetical) and board cards are sorted by `modifiedAt` (most recent first). There is no way for a user to manually arrange pages or cards in a preferred order. For a family wiki, manual ordering is essential — e.g., putting "Getting Started" first, ordering recipe categories by frequency, or prioritising tasks on a board.

## Data Model

### sortOrder Field

- Integer field in YAML frontmatter: `sortOrder: 0`
- Controls position among siblings (pages with the same parent)
- Lower values sort first
- Pages without `sortOrder` (legacy pages, or newly created before reorder) sort after all ordered pages, then by title alphabetically
- The field is set automatically by the reorder endpoint — users never edit it directly

### Reorder Endpoint

```
PUT /pages/reorder
Body: { parentGuid: string | null, orderedGuids: string[] }
```

- `parentGuid` — the shared parent of all pages being reordered (`null` for root-level)
- `orderedGuids` — complete ordered list of sibling GUIDs in desired order
- Backend assigns `sortOrder = index * 1000` to each page (gaps allow future insertions without full reorder)
- Validates all GUIDs are actual children of `parentGuid`
- Partial reorders are supported — GUIDs not in the list keep their existing sortOrder
- Returns `200 OK` with `{ updated: number }`

### Why Gaps (×1000)?

Using gaps between sortOrder values (0, 1000, 2000...) means single-page inserts or moves can be done without rewriting all siblings. A page inserted between sortOrder 1000 and 2000 gets 1500. The full reorder endpoint re-normalises when the user does a drag operation.

## Done Criteria

### Backend

- `sortOrder` field parsed from and serialised to YAML frontmatter in S3StoragePlugin
- `listChildren()` sorts by `sortOrder` ascending, then by `title` ascending for ties/unordered pages
- `pages-create` assigns `sortOrder` = (max sibling sortOrder + 1000) for new pages
- `PUT /pages/reorder` endpoint validates and persists new order
- Reorder endpoint requires authentication (same as other page endpoints)

### Page Tree (Frontend)

- Dragging a page between siblings at the same level triggers a reorder (not a reparent)
- Drop indicator (horizontal line) appears between items to show insertion point
- Dragging onto a page (existing behaviour) still reparents
- After reorder, tree reflects new order immediately (optimistic update)
- Reverts on failure with toast notification

### Board View (Frontend)

- Cards within a column can be dragged up/down to reorder
- Drop indicator appears between cards to show insertion point
- Reorder calls the same `PUT /pages/reorder` endpoint
- Optimistic update with revert on failure
- Cross-column drag (existing behaviour) still changes state — reorder only applies within a column

### Types

- `PageSummary` and `PageContent` gain `sortOrder?: number` field
- `ReorderRequest` type: `{ parentGuid: string | null, orderedGuids: string[] }`
- New `useReorderPages` mutation hook

## Constraints

- **No fractional ordering** — sortOrder is always an integer. The reorder endpoint normalises values.
- **No per-user ordering** — sort order is global, shared across all users.
- **Board reorder uses parentGuid** — for deep boards (descendants by type), the parentGuid is the card's actual parent, not the board page.
- **Existing pages** — pages created before this feature have no `sortOrder`. They sort after ordered pages, by title. First reorder operation on a parent assigns order to all children.

## Error Policy

- Reorder endpoint failure: revert UI to previous order, show toast
- Partial save failure (some pages updated, some not): return error with count of successful updates. Frontend refetches to get actual state.
- Invalid GUID in orderedGuids: return 400 with details of which GUIDs are invalid

## References

- [Design](../design.md) — Data model, page frontmatter format
- [Kanban Board](kanban/kanban-board.md) — Board view, card ordering mention
