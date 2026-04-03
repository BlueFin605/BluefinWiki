---
description: Investigation into MCP property write support — what exists, what's broken, what's missing
tags: [mcp, properties, page-types, validation]
audience: { human: 40, agent: 60 }
purpose: { findings: 100 }
---

**Question**: Can the BluefinWiki MCP create and update pages with typed properties? If not, what needs to change?

---

**Finding**: Property write support already exists in both `create_page` and `update_page`. The schema accepts properties, both implementations wire them through to S3 storage, and the serialization path handles all four property types. The actual gaps are: `update_page` skips all property validation, neither tool surfaces page-type validation warnings to the caller, and `update_page` does full property replacement rather than merge.

---

## Evidence

### Properties are accepted and stored today

Both MCP tool schemas declare a `properties` parameter accepting `{ type, value }` objects keyed by kebab-case name.

> [mcp-handler.ts:122-125](../backend/src/mcp/mcp-handler.ts) — `create_page` schema includes `properties` with description referencing `list_page_types`
> [mcp-handler.ts:162-164](../backend/src/mcp/mcp-handler.ts) — `update_page` schema includes `properties` with full-replacement semantics documented

Both implementations accept `properties` on their input interface and spread them into the `PageContent` object before saving.

> [create-page.ts:25](../backend/src/mcp/tools/create-page.ts) — `CreatePageInput` includes `properties?: Record<string, PageProperty>`
> [create-page.ts:127](../backend/src/mcp/tools/create-page.ts) — properties spread into `PageContent`
> [update-page.ts:22](../backend/src/mcp/tools/update-page.ts) — `UpdatePageInput` includes `properties?: Record<string, PageProperty>`
> [update-page.ts:74-76](../backend/src/mcp/tools/update-page.ts) — properties merged (full replacement) into updated page

The S3 storage plugin serializes all four property types (`string`, `number`, `date`, `tags`) into YAML frontmatter.

> [S3StoragePlugin.ts:426-443](../backend/src/storage/S3StoragePlugin.ts) — YAML serialization handles each property type

### Gap 1: `update_page` has no property validation

`create_page` validates property names are kebab-case and that each property's value matches its declared type (string, number, date pattern, array). `update_page` performs none of these checks — properties pass straight through to storage.

> [create-page.ts:64-88](../backend/src/mcp/tools/create-page.ts) — inline validation: kebab-case regex, type/value switch with specific error messages
> [update-page.ts:32-97](../backend/src/mcp/tools/update-page.ts) — no property validation present anywhere in the function

Effect: an MCP client can write `{ type: "number", value: "not-a-number" }` via update and it will be saved to S3 without error.

### Gap 2: Page-type validation warnings are invisible to the caller

Both tools call `validatePageType()` when a `pageType` is set. This function checks supplied properties against the page type's schema — required fields present, types matching. But both tools only log warnings to CloudWatch and never return them to the MCP client.

> [create-page.ts:91-96](../backend/src/mcp/tools/create-page.ts) — `console.warn('Page type validation warnings:', ...)` — not included in tool response
> [page-type-validation.ts:22-50](../backend/src/pages/page-type-validation.ts) — returns `{ warnings: string[] }`, advisory only

Effect: an MCP client creating a TV Show page without a required `state` property gets no feedback. The page saves, the warning goes to CloudWatch, the client assumes success.

`update_page` does not call `validatePageType()` at all — not even advisory logging.

### Gap 3: Full replacement semantics on update

`update_page` replaces all properties when any are provided. Updating one property requires re-sending every property.

> [update-page.ts:74-76](../backend/src/mcp/tools/update-page.ts) — `properties !== undefined` triggers full replacement, no merge with existing

This is documented in the tool description but creates friction during imports: the MCP client must `get_page`, parse YAML frontmatter to extract existing properties, merge locally, then send the full set back. The REST API has the same semantics, so this is a design-level decision, not an MCP-specific bug.

### Context: The REST API already has full property support

The REST endpoints `POST /pages` and `PUT /pages/{guid}` accept properties with Zod validation and return structured JSON including properties. This is not a new capability — MCP is catching up to what the API already does.

> [pages-create.ts:12-29](../backend/src/pages/pages-create.ts) — Zod schemas for property validation
> [pages-update.ts:11-26](../backend/src/pages/pages-update.ts) — identical Zod validation

### Context: Page type definitions are runtime data

Page types (TV Show, Season, etc.) are stored in DynamoDB and created via `POST /page-types`. There are no hardcoded definitions in the codebase. The MCP `list_page_types` tool exposes all type definitions including their property schemas.

> [types/index.ts:67-86](../backend/src/types/index.ts) — `PageTypeDefinition` with `properties: PageTypeProperty[]`
> [list-page-types.ts:35-63](../backend/src/mcp/tools/list-page-types.ts) — returns full type definitions to MCP clients

## Decisions

**Gap 2 resolution: blocking validation in MCP tools.** Page-type validation will reject saves (throw errors) in MCP tools when required properties are missing or types don't match the page type schema. The REST API's advisory behavior is unchanged — this is an MCP-specific decision to prevent data corruption during automated imports.

**Gap 3 resolution: merge semantics with null-to-delete.** `update_page` will merge supplied properties with existing ones instead of replacing the full set. Sending `null` for a property key removes it. Omitting a key leaves it unchanged. This matches the existing `pageType` null-to-remove pattern already in `update_page`.

```json
{
  "properties": {
    "state": { "type": "string", "value": "Completed" },
    "service": null
  }
}
```

Effect: `state` updated, `service` removed, all other properties untouched.

## What I could not determine

- Whether the existing `create_page` property path has been exercised in production (no telemetry in codebase to check)
- Whether `list_page_types` caching (`let cachedTypes` at module level in `list-page-types.ts:31`) causes stale schema data during warm Lambda reuse
- The actual page type definitions deployed (TV Show, Season property schemas) — these exist only in live DynamoDB
