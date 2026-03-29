---
description: Plan for custom page properties — typed key-value metadata on pages, shared tag vocabulary
tags: [bluefinwiki, plan, properties, tags, metadata, kanban]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Custom Properties

Implements: [Design](../design.md) — Page metadata, DynamoDB tables
Part of: Kanban feature set (Step 1 of 4)

## Scope

**Covers:**
- Typed custom properties on pages (string, number, date, tags)
- Extension of YAML frontmatter with a `properties` block
- Shared tag vocabulary stored in DynamoDB
- Backend API for reading and writing page properties
- Backend API for tag vocabulary (list, create — tags auto-register on use)
- Frontend property editor panel on the page editor

**Does not cover:**
- Page types (Step 2 — defines which properties a page should have)
- Kanban board view (Step 3)
- Default templates (Step 4)

## Enables

Once custom properties exist:
- **Page types** can define property schemas (which properties, which are required)
- **Kanban boards** can use a `state` property to group pages into columns
- **Metadata filtering** can query pages by property values
- **Tag-based discovery** uses the shared vocabulary for autocomplete and aggregation

This is foundational. Every subsequent Kanban step depends on properties existing.

## Prerequisites

- Page Index operational — **done** (O(1) GUID lookups)
- YAML frontmatter parsing in S3StoragePlugin — **done**
- DynamoDB access from Lambda — **done**

## North Star

A family member should be able to add structured data to any page — a date, a rating, a status, a set of tags — and have the wiki understand that data as more than just text. Properties turn pages from documents into structured records when needed, without forcing structure on pages that don't need it.

## The Problem

Pages currently have a fixed set of metadata fields in YAML frontmatter (`title`, `guid`, `parentGuid`, `status`, `tags`, `description`, timestamps, authorship). There is no way to add custom named values with known types. The existing `tags` field is a flat array of strings with no shared vocabulary — users can type anything, but there's no autocomplete, no aggregation, no way to see what tags exist across the wiki.

To support Kanban boards, TV tracking, or any structured workflow, pages need arbitrary typed properties that the system can reason about (sort by date, filter by state, group by tag).

## Done Criteria

### Frontmatter Extension

The YAML frontmatter shall support an optional `properties` block:

```yaml
---
title: Breaking Bad
guid: abc-123
parentGuid: null
status: published
properties:
  genre:
    type: tags
    value: [drama, crime, thriller]
  rating:
    type: number
    value: 9.5
  first-aired:
    type: date
    value: "2008-01-20"
  network:
    type: string
    value: "AMC"
---
```

- Property names are kebab-case strings
- Each property has a `type` (string | number | date | tags) and a `value`
- `string`: free-text string value
- `number`: numeric value (integer or decimal)
- `date`: ISO 8601 date string (YYYY-MM-DD)
- `tags`: array of strings, drawn from the shared tag vocabulary
- Properties are optional — pages without the `properties` block remain valid
- The existing top-level `tags` field continues to work unchanged (backward compatible)

### TypeScript Types

```typescript
type PropertyType = 'string' | 'number' | 'date' | 'tags';

interface PageProperty {
  type: PropertyType;
  value: string | number | string[];  // type-dependent
}

interface PageContent {
  // ... existing fields ...
  properties?: Record<string, PageProperty>;
}
```

### Backend API

- `GET /pages/:guid` shall return properties in the page response (already does via frontmatter — just needs parsing)
- `PUT /pages/:guid` shall accept properties in the request body and persist them to frontmatter
- `GET /tags` shall return all known tags from the vocabulary table, sorted alphabetically
- `POST /tags` shall add a tag to the vocabulary (admin only) — but tags also auto-register when used in a property value
- Tags used in `properties` with `type: tags` shall be auto-registered in the vocabulary table if not already present

### DynamoDB: Tags Vocabulary

| Attribute | Type | Description |
|-----------|------|-------------|
| `tag` (PK) | String | The tag name, lowercase |
| `createdAt` | String | ISO 8601 timestamp |
| `createdBy` | String | Cognito sub of whoever first used the tag |
| `usageCount` | Number | Approximate count (updated on page save, best-effort) |

- On-demand capacity (consistent with other tables)
- Tags are case-insensitive (stored lowercase, displayed as-is from first use)
- No delete API in MVP — tags accumulate. Admin cleanup can come later.

### Frontmatter Parsing

- `S3StoragePlugin` shall read and write the `properties` block in YAML frontmatter
- Unknown property types shall be preserved on read (forward compatibility) but flagged with a warning
- Empty `properties: {}` shall be omitted from written frontmatter (keep files clean)
- Property values shall be validated on write: number must be numeric, date must be valid ISO date, tags must be an array of strings

### Frontend: Property Editor Panel

- A collapsible "Properties" panel below the editor (or in a sidebar tab)
- Displays existing properties with type-appropriate inputs:
  - `string`: text input
  - `number`: number input
  - `date`: date picker
  - `tags`: tag input with autocomplete from the shared vocabulary
- Add property button: name input + type selector dropdown
- Remove property button (with confirmation)
- Properties save with the page (same save action, not separate)

### Search Index

- Properties shall be included in the search index (`search-index.json`)
- String and tags property values shall be searchable via Fuse.js
- Number and date values indexed but not fuzzy-searchable (exact match only in future filter APIs)

## Constraints

- **Frontmatter is the source of truth for properties** — no separate DynamoDB table for property values. Properties live with the page.
- **Tag vocabulary is DynamoDB** — separate from the properties themselves. The vocabulary is an index for autocomplete and aggregation, not the source of truth for which tags a page has.
- **No breaking changes to existing pages** — pages without `properties` must continue to work unchanged.
- **The existing `tags` field on PageContent remains** — it is a separate concern (page-level tags for search/categorization). Custom properties with `type: tags` are for structured data within the properties system. The two may converge later, but for now they coexist.

## Error Policy

Invalid property type on write: reject with 400 and descriptive error. Invalid property value (e.g., "abc" for a number property): reject with 400. Tag vocabulary write failure: page save still succeeds (tag registration is best-effort). Frontend validation mirrors backend validation — don't rely on it.

## References

- [Design](../design.md) — YAML frontmatter format, DynamoDB tables
- [Plan: Page Types](page-types.md) — Step 2, depends on this plan
- `backend/src/types/index.ts` — `PageContent` interface
- `backend/src/storage/S3StoragePlugin.ts` — frontmatter parsing
