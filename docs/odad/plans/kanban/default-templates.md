---
description: Plan for default templates — preconfigured page type hierarchies shipped with the wiki, starting with TV Tracker
tags: [bluefinwiki, plan, templates, tv-tracker, kanban, onboarding]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Default Templates

Implements: [Design](../design.md) — Page types, Kanban board
Part of: Kanban feature set (Step 4 of 4)

## Scope

**Covers:**
- Template system for preconfigured page type hierarchies
- A default "TV Tracker" template: Show → Season → Episode
- Template application creates the type definitions and an optional starter page
- Users can create their own templates (export a type hierarchy as a template)

**Does not cover:**
- Custom properties (Step 1 — already built)
- Page types (Step 2 — already built)
- Kanban board view (Step 3 — already built)
- Template marketplace or sharing between wiki instances

## Enables

Once templates exist:
- **Instant onboarding** — a user can create a fully structured TV tracker (or task board, or recipe collection) with one action
- **Reusable patterns** — define a type hierarchy once, apply it to multiple parent pages
- **Community patterns** — future: share templates as JSON exports/imports

## Prerequisites

- Custom Properties operational — **Step 1**
- Page Types operational — **Step 2**
- Kanban Board operational — **Step 3**

## North Star

A family member should be able to set up a TV tracker, a task board, or a recipe collection in one click — with the right page types, properties, and board configuration already wired up. Templates remove the blank-page problem for structured content.

## Done Criteria

### Template Definition

```typescript
interface PageTypeTemplate {
  name: string;                      // Template name (e.g. "TV Tracker")
  description: string;               // What this template is for
  icon: string;                      // Template icon
  types: PageTypeDefinition[];       // Type definitions to create
  rootType: string;                  // Which type GUID is the top-level entry point
  boardConfig?: BoardConfig;         // Default board configuration for the root type
  sampleContent?: SamplePage[];      // Optional starter pages
}

interface SamplePage {
  title: string;
  typeGuid: string;                  // References a type in the template
  properties: Record<string, PageProperty>;
  children?: SamplePage[];
}
```

### Built-in: TV Tracker

**Types:**

| Type | Icon | Properties | Required | Allowed Children |
|------|------|-----------|----------|-----------------|
| Show | 📺 | `genre` (tags), `rating` (number), `network` (string), `state` (string) | `state` | Season |
| Season | 📂 | `season-number` (number), `air-year` (number), `state` (string) | `season-number`, `state` | Episode |
| Episode | 🎬 | `episode-number` (number), `air-date` (date), `state` (string), `rating` (number) | `episode-number`, `state` | None |

**State values:** Unwatched, Watching, Completed, Dropped

**Board config:** Columns ordered as [Unwatched, Watching, Completed, Dropped]

**Sample content** (optional, user can skip):
- Show: "Breaking Bad"
  - Season: "Season 1" (season-number: 1, air-year: 2008)

### Template Application

- `POST /templates/apply` — accepts a template definition, creates the type definitions in DynamoDB, optionally creates a root page with sample content
- If types with the same name already exist, create new ones (templates don't overwrite)
- Returns the created type GUIDs and optional root page GUID

### Template Management

- **Built-in templates** ship as JSON files in the backend (`templates/` directory). Not editable by users.
- **User templates** are future — export a set of type definitions as a template JSON. Stored in S3 at `_templates/{guid}.json`.
- Frontend: "New from Template" option in the create page flow. Shows available templates with description and preview of the type hierarchy.

### Frontend

- Template picker accessible from:
  - Create page dialog ("Start from template")
  - Admin page types section ("Import template")
- Template preview shows the type hierarchy, properties, and board layout
- Application wizard: confirm template name, optionally customise type names/icons before applying
- After application, navigate to the created root page (if sample content was created) or to the admin types page

## Constraints

- **Templates create types, they don't own them** — once applied, the created types are independent. Editing them doesn't affect the template definition.
- **Built-in templates are read-only** — shipped with the codebase, not stored in DynamoDB.
- **No template versioning** — templates are fire-and-forget. If we update the built-in TV Tracker template, already-applied instances are not affected.
- **Sample content is optional** — the template primarily creates type definitions. Sample pages are a convenience.

## Error Policy

Template application is atomic per type — if creating type 2 of 3 fails, types already created remain (they're still useful individually). Sample content creation failure: types still created, warn user that sample pages weren't generated.

## References

- [Plan: Custom Properties](custom-properties.md) — Step 1
- [Plan: Page Types](page-types.md) — Step 2
- [Plan: Kanban Board](kanban-board.md) — Step 3
- [Design](../design.md) — DynamoDB tables, S3 storage
