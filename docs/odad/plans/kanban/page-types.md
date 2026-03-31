---
description: Plan for page types — named schemas that define what properties a page has, allowed child types, and visual identity
tags: [bluefinwiki, plan, page-types, schema, kanban]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Page Types

Implements: [Design](../design.md) — Page metadata, DynamoDB tables
Part of: Kanban feature set (Step 2 of 4)

## Scope

**Covers:**
- Page type definitions (GUID + display name + icon + property schema + allowed child types)
- DynamoDB storage for type definitions
- Assigning a type to a page (stored in frontmatter)
- Enforcing required properties when a page has a type
- Constraining which child types can be created under a typed page
- Standard wiki pages (no type assigned) remain unaffected
- Backend APIs for type CRUD
- Frontend type management UI (admin) and type assignment UI (all users)

**Does not cover:**
- Kanban board view (Step 3)
- Default templates and preconfigured hierarchies (Step 4)

## Enables

Once page types exist:
- **Kanban boards** can identify which pages are "tickets" (typed pages with a `state` property)
- **Hierarchy constraints** enforce structure (Show → Season → Episode) without breaking free-form wiki pages
- **Visual identity** — typed pages show their icon in the sidebar tree
- **Default templates** (Step 4) are just pre-created type definitions

## Prerequisites

- Custom Properties operational — **Step 1** (properties exist on pages, tag vocabulary works)

## North Star

A family member should be able to define different kinds of pages — a "Show", a "Season", an "Episode" — each with its own set of properties and rules about what can be nested inside it. Regular wiki pages should continue to work exactly as before. Types add structure where you want it, without imposing it everywhere.

## The Problem

All pages are currently identical in structure — same frontmatter fields, no schema, no constraints on what children they can have. To build a Kanban board or a TV tracker, the system needs to know that a "Show" page should have a `genre` and `rating`, that a "Season" page can only be a child of a "Show", and that an "Episode" must have a `state` property. Without types, pages are just documents — with types, they can become structured records in a hierarchy.

## Done Criteria

### Type Definition Model

```typescript
interface PageTypeDefinition {
  guid: string;                    // Immutable identifier (UUID v4)
  name: string;                    // Display name (mutable, e.g. "TV Show")
  icon: string;                    // Icon identifier (emoji or icon library key)
  properties: PageTypeProperty[];  // Property schema
  allowedChildTypes: string[];     // GUIDs of types that can be created as children
  allowWikiPageChildren: boolean;  // Whether untyped wiki pages can be children (default true)
  createdBy: string;               // Cognito sub
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}

interface PageTypeProperty {
  name: string;                    // Property name (kebab-case)
  type: PropertyType;              // string | number | date | tags
  required: boolean;               // Must be set when saving the page
  defaultValue?: string | number | string[];  // Optional default
}
```

- A type's GUID is immutable — renaming a type changes `name`, not `guid`
- `allowedChildTypes: []` means no typed children can be created (but untyped wiki pages still can, unless `allowWikiPageChildren` is false)
- `allowedChildTypes` does not constrain *moving* pages — only *creating* new children. This keeps drag-and-drop flexible.

### DynamoDB: Page Types Table

| Attribute | Type | Description |
|-----------|------|-------------|
| `guid` (PK) | String | Type GUID (UUID v4) |
| `name` | String | Display name |
| `icon` | String | Icon identifier |
| `properties` | String (JSON) | Serialised `PageTypeProperty[]` |
| `allowedChildTypes` | String (JSON) | Serialised `string[]` of type GUIDs |
| `allowWikiPageChildren` | Boolean | Whether untyped children are allowed |
| `createdBy` | String | Cognito sub |
| `createdAt` | String | ISO 8601 |
| `updatedAt` | String | ISO 8601 |

- On-demand capacity
- No GSI needed in MVP — type list is small enough to scan

### Page Frontmatter Extension

```yaml
---
title: Breaking Bad
guid: abc-123
parentGuid: null
status: published
pageType: <type-guid>
properties:
  genre:
    type: tags
    value: [drama, crime, thriller]
  rating:
    type: number
    value: 9.5
  state:
    type: string
    value: "Completed"
---
```

- `pageType` is optional. When absent, the page is a standard wiki page with no type constraints.
- When `pageType` is set, `savePage` validates that all required properties defined by the type are present.
- Removing a type from a page (`pageType: null`) does not remove its properties — they remain as custom properties.

### Backend API

- `GET /page-types` — list all type definitions
- `GET /page-types/:guid` — get a single type definition
- `POST /page-types` — create a new type definition (any authenticated user)
- `PUT /page-types/:guid` — update a type definition (creator or admin)
- `DELETE /page-types/:guid` — delete a type definition (creator or admin). Does not affect pages already using the type — they keep their `pageType` field but validation stops enforcing the deleted type's schema.
- `GET /page-types/:guid/allowed-children` — returns the type definitions allowed as children (convenience endpoint for UI)

### Validation Rules

- On `savePage` with `pageType` set:
  - Look up the type definition
  - Validate all `required: true` properties are present in the page's `properties`
  - Validate property types match the schema
  - If type definition not found (deleted type), skip validation — page saves normally
- On `createPage` as child of a typed parent:
  - If the new page has a `pageType`, check it appears in the parent type's `allowedChildTypes`
  - If the new page has no `pageType`, check the parent type's `allowWikiPageChildren` is true
  - If parent has no type, allow anything (standard wiki behaviour)
- These constraints are advisory in MVP — warn but don't hard-block. This prevents data loss from overly strict enforcement during early use.

### Frontend: Type Management

- **Admin page** (`/admin/page-types`):
  - List all types with icon and name
  - Create new type: name, icon picker, property schema builder
  - Edit type: change name, icon, add/remove/reorder properties, set allowed children
  - Delete type (with warning about existing pages)
- **Property schema builder**:
  - Add property: name, type dropdown, required checkbox, default value
  - Reorder properties (drag-and-drop)
  - Remove property

### Frontend: Type Assignment

- **Page editor**: type selector dropdown in the metadata panel
  - Shows available types (icon + name)
  - "None" option for standard wiki page
  - Changing type updates the property editor to show the type's properties
  - Required properties highlighted, validated before save
- **Create page dialog**: when creating a child of a typed page, show only allowed child types
  - If the parent allows wiki pages too, include "Wiki Page" as an option
- **Sidebar tree**: typed pages show their type icon next to the page title

## Constraints

- **Standard wiki pages are the default** — types are opt-in. No page requires a type.
- **Types are stored in DynamoDB, type assignment in frontmatter** — the type GUID in frontmatter is a reference to DynamoDB. If the type is deleted, the page still functions (just without type validation).
- **No type inheritance** — types are flat. A "Season" type does not inherit from "Show". Keep it simple.
- **No property value constraints beyond type** — no min/max for numbers, no regex for strings, no enum values (except via tags). These can be added later.

## Error Policy

Type not found on page load: ignore `pageType`, return page normally. Required property missing on save: return 400 with list of missing required properties (advisory in MVP — configurable to warn vs block). Child type not allowed: return 400 with descriptive error. Type creation with duplicate name: allowed (names are not unique, GUIDs are).

## References

- [Plan: Custom Properties](custom-properties.md) — Step 1 prerequisite
- [Plan: Kanban Board](kanban-board.md) — Step 3, depends on this plan
- [Design](../design.md) — DynamoDB tables, frontmatter format
- `backend/src/types/index.ts` — `PageContent` interface (needs `pageType` field)
