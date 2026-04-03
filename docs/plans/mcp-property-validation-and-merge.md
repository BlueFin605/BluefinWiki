---
description: Plan for fixing MCP property validation gaps, adding merge semantics, and enforcing page-type schema
tags: [mcp, properties, validation, merge, page-types]
audience: { human: 40, agent: 60 }
purpose: { plan: 95, design: 5 }
---

# Plan: MCP Property Validation and Merge Semantics

Implements: [MCP Typed Page Management flow](../flows/mcp-typed-page-management.md)
Findings: [MCP Property Write Support](../findings/mcp-property-write-support.md)

## Scope

**Covers:**
- Property input validation in `update_page` (parity with `create_page`)
- Merge semantics for property updates with null-to-delete
- Blocking page-type schema validation in both MCP tools
- Unknown property rejection for typed pages
- Default value auto-fill on `create_page`

**Does not cover:**
- REST API changes (advisory validation behavior unchanged)
- New MCP tools (no `get_properties` or `patch_properties`)
- Changes to `list_page_types` caching
- Page type schema changes (runtime data in DynamoDB)

## Enables

MCP clients can reliably create and update typed pages with properties during automated imports. Validation errors surface immediately to the caller, preventing silent data corruption. Merge semantics eliminate the need to round-trip all properties on every update.

## Prerequisites

- `create_page` property input validation exists and works ([create-page.ts:64-88](../../backend/src/mcp/tools/create-page.ts))
- `validatePageType` function exists and returns warnings ([page-type-validation.ts:22-50](../../backend/src/pages/page-type-validation.ts))
- `PageTypeDefinition` includes `properties: PageTypeProperty[]` with `required`, `type`, and `defaultValue` fields ([types/index.ts:67-86](../../backend/src/types/index.ts))

## North Star

An MCP client that sends well-formed properties against a known page type schema succeeds on the first attempt. An MCP client that sends malformed, unknown, or missing-required properties gets a clear, actionable error message — never a silent save of bad data.

## Done Criteria

### Input Validation in `update_page`

- The `update_page` tool shall validate each property key is kebab-case before saving
- The `update_page` tool shall validate each property's value matches its declared type (`string` -> string, `number` -> number, `date` -> YYYY-MM-DD string, `tags` -> string array)
- If a property fails input validation, then the `update_page` tool shall reject the request with an error naming the property and the expected format

### Merge Semantics

- When `update_page` receives properties, the tool shall merge them with the page's existing properties rather than replacing the full set
- When a property value is `null`, the `update_page` tool shall remove that property from the page
- When a property key is omitted from the update, the tool shall preserve the existing value of that property
- When an empty `properties` object (`{}`) is sent, the tool shall leave all existing properties unchanged

### Blocking Page-Type Schema Validation

- When a page has a `pageType` and `create_page` is called with properties missing a required field, then the tool shall reject the request with an error naming the missing property
- When a page has a `pageType` and `update_page` would result in a required property being absent (via null-to-delete or never set), then the tool shall reject the request with an error naming the required property
- When a page has a `pageType` and a property key is not defined in the page type schema, then both tools shall reject the request with an error naming the unknown property
- When a page has a `pageType` and a property's type does not match the page type schema's declared type for that key, then both tools shall reject the request with an error stating the expected type
- While a page has no `pageType`, the tools shall only perform input validation (kebab-case, type/value consistency) — no schema-level checks

### Default Value Auto-Fill

- When `create_page` is called with a `pageType` and omits a non-required property that has a `defaultValue` in the page type schema, the tool shall auto-fill that property with the default value
- The `update_page` tool shall not auto-fill defaults (merge semantics — absence means "don't change")

### Error Responses

- The tools shall return MCP error responses (not just log to CloudWatch) for all validation failures
- Each error response shall include the property name and a human-readable description of the violation
- The tools shall not save the page when any validation error occurs

## Constraints

- **Ownership boundary**: REST API validation stays advisory — this plan only changes MCP tool behavior
- **Separate validation path**: A new MCP-specific validation function handles blocking schema validation (unknown properties, missing required, type mismatches, null-to-delete on required, default auto-fill). The existing `validatePageType` is left untouched — REST API advisory behavior is unchanged. The MCP tools stop calling `validatePageType` and use the new function instead
- **Type compatibility**: The `properties` field in `UpdatePageInput` must accept `null` values per-key for the delete signal, changing from `Record<string, PageProperty>` to `Record<string, PageProperty | null>`

## References

- [create-page.ts](../../backend/src/mcp/tools/create-page.ts) — existing input validation to match
- [update-page.ts](../../backend/src/mcp/tools/update-page.ts) — primary file to modify
- [page-type-validation.ts](../../backend/src/pages/page-type-validation.ts) — existing advisory validation, returns `{ warnings: string[] }`
- [page-types-service.ts](../../backend/src/page-types/page-types-service.ts) — `getPageType(guid)` for schema lookup
- [types/index.ts](../../backend/src/types/index.ts) — `PageProperty`, `PageTypeProperty`, `PageTypeDefinition`
- [mcp-handler.ts](../../backend/src/mcp/mcp-handler.ts) — tool schema definitions (update `properties` description for merge semantics)

## Error Policy

Validation errors are blocking — reject the request, do not save. Return structured MCP error with property name and violation description. No partial saves: either all properties pass validation or none are written.
