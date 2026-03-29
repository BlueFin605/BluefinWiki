---
description: Plan for Kanban board view — visualise typed child pages as cards in state-based columns
tags: [bluefinwiki, plan, kanban, board, state, workflow]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Kanban Board

Implements: [Design](../design.md) — Frontend views, page hierarchy
Part of: Kanban feature set (Step 3 of 4)

## Scope

**Covers:**
- Kanban board view for any page that has typed children with a `state` property
- Board columns derived from the `state` property values of child pages
- Drag-and-drop between columns (updates `state` property)
- Card display showing page title, type icon, and key properties
- Toggle between board view and standard wiki view
- State configuration (column order, column colours) on the parent page

**Does not cover:**
- Custom properties (Step 1 — already built)
- Page types (Step 2 — already built)
- Default templates and preconfigured hierarchies (Step 4)
- Swimlanes, WIP limits, or advanced Kanban features (post-MVP)

## Enables

Once the Kanban board exists:
- **TV tracking** — a "Show" page displays its seasons/episodes as cards moving through states (Unwatched → Watching → Completed)
- **Task management** — any hierarchical work can be visualised as a board
- **Default templates** (Step 4) can ship with a ready-to-use board experience

## Prerequisites

- Custom Properties operational — **Step 1**
- Page Types operational — **Step 2** (types define the `state` property)

## North Star

A family member should be able to view any page's children as a Kanban board, with cards grouped by state and moveable between columns with a drag. The board is just a view — the underlying data is still pages with properties. Switching between board view and tree view shows the same content differently.

## The Problem

The wiki currently shows hierarchy only as a tree in the sidebar. For workflow-oriented content (tracking TV shows, managing tasks, planning events), a board view grouped by state is more natural. Users need to see at a glance what's in progress, what's done, and what's queued — then move items between states with a drag.

## Done Criteria

### Board Activation

- A page shall show a "Board" view toggle when it has child pages that are typed and the type has a property named `state`
- The board view is a sibling of the page content view (tab or toggle), not a replacement
- The page's own content (Markdown) is still viewable and editable — the board is an additional view of its children

### State Configuration

The parent page can configure the board via a `boardConfig` in its frontmatter properties:

```yaml
properties:
  board-config:
    type: string
    value: '{"columns":["Backlog","In Progress","Done"],"colors":{"Backlog":"#gray","In Progress":"#blue","Done":"#green"}}'
```

- If no `board-config` property exists, columns are derived dynamically from the distinct `state` values of child pages
- Column order: configured order first, then any unconfigured states alphabetically at the end
- An "Uncategorised" column appears for children with no `state` property (or children with no type)

### Board Layout

- Horizontal scrolling columns (standard Kanban layout)
- Each column has a header with the state name and card count
- Column colours from config (or sensible defaults)
- Responsive: on mobile, columns stack vertically or become a swipeable carousel

### Cards

- Each card represents a child page
- Card displays: type icon, page title, and up to 3 key properties (configured or auto-selected)
- Clicking a card navigates to that page
- Cards within a column are ordered by `modifiedAt` (most recent first) — configurable later
- Visual distinction for different child types (icon colour or badge)

### Drag-and-Drop

- Cards can be dragged between columns
- Dropping a card in a new column updates its `state` property via `PUT /pages/:guid`
- Optimistic UI: card moves immediately, reverts on failure
- Drag-and-drop within a column reorders (order stored as a `sort-order` number property on the page — optional, not required for MVP)

### Backend

- No new API endpoints required — the board reads child pages via `GET /pages/:guid/children` (existing `listChildren`) and property data from each page
- State updates use existing `PUT /pages/:guid` (updating the `state` property)
- **Performance consideration**: loading a board requires fetching properties for all children. For boards with many children (50+), a batch endpoint `GET /pages/:guid/children?include=properties` may be needed. In MVP, the frontend can fetch child summaries then load properties for visible cards only.

### Frontend Components

- `BoardView` — top-level board component, receives parent page GUID
- `BoardColumn` — a single column, receives state name and cards
- `BoardCard` — a card representing a child page
- `BoardConfig` — configuration panel for column order and colours
- Uses the same drag-and-drop library as the existing tree (or a compatible one)

### Sidebar Tree Enhancement

- Typed pages in the sidebar tree shall show their type icon
- The `state` value shall be shown as a subtle badge or colour indicator on tree items
- Tree remains the primary navigation — the board is a view, not a replacement

## Constraints

- **Board is read-only for hierarchy** — you can change state by dragging between columns, but you cannot reparent pages on the board. Use the sidebar tree for that.
- **Board does not create pages** — there should be a "+ Add" button at the bottom of each column that creates a new child page with the appropriate type and `state` pre-set. But the actual page creation uses the existing create flow.
- **State is just a string property** — no workflow engine, no transitions, no state machine. Any card can move to any column. Workflow rules can come later.
- **No swimlanes in MVP** — all cards in one row per column. Grouping by a second property (e.g., by season within a show) is a future enhancement.
- **No WIP limits in MVP** — columns accept unlimited cards.

## Error Policy

Child page load failure: show card with error state, retry button. State update failure: revert card position, show toast notification. Board config parse failure: fall back to dynamic column derivation.

## References

- [Plan: Custom Properties](custom-properties.md) — Step 1
- [Plan: Page Types](page-types.md) — Step 2
- [Plan: Default Templates](default-templates.md) — Step 4
- [Design](../design.md) — Frontend architecture, page hierarchy
