---
description: How an MCP client creates and updates wiki pages with typed properties, including discovery, validation, and error handling
tags: [mcp, properties, page-types, import, validation]
audience: { human: 50, agent: 50 }
purpose: { flow: 90, reference: 10 }
---

# MCP Typed Page Management

An MCP client (typically an AI agent) creates and updates wiki pages with structured, typed properties that conform to a page type schema. The flow covers discovery of available types, property authoring, validation enforcement, and property updates with merge semantics.

## Trigger

An MCP client needs to create or update a page that has a page type (e.g. TV Show, Season) with typed properties (state, rating, service, episodes).

## Stages

### 1. Discover Page Types

**Actor**: MCP client
**Action**: Calls `list_page_types` to retrieve all page type definitions, including their property schemas — names, types (`string`, `number`, `date`, `tags`), required flags, and default values.
**Output**: List of `PageTypeDefinition` objects. Each contains `guid`, `name`, `properties[]`, `allowedChildTypes[]`, `allowedParentTypes[]`.
**Failure**: Table read error returns MCP error response. Client retries or reports.

The client uses this response to determine which `pageType` GUID to use and which properties to supply. The property schema is the contract — the client must match it.

### 2. Discover Parent Page (if creating a child)

**Actor**: MCP client
**Action**: Calls `list_pages` or `search_pages` to find the parent page GUID. If the page type has `allowedParentTypes`, the client must verify the parent's type matches.
**Output**: Parent page GUID.
**Failure**: Parent not found — client cannot create child page. Parent type not in `allowedParentTypes` — `create_page` will reject with a child-type constraint error.

### 3. Create Page with Properties

**Actor**: MCP client
**Action**: Calls `create_page` with `title`, `pageType` (GUID), and `properties` object. Each property key is kebab-case, each value is `{ type, value }` matching the page type schema.

Example payload:
```json
{
  "title": "Breaking Bad",
  "pageType": "abc-123-tv-show-type-guid",
  "properties": {
    "state": { "type": "string", "value": "Completed" },
    "rating": { "type": "number", "value": 9.5 },
    "service": { "type": "string", "value": "Netflix" },
    "genres": { "type": "tags", "value": ["Drama", "Thriller"] }
  }
}
```

**Output**: Page GUID, title, creation timestamp.
**Failure modes**:

| Failure | Cause | Effect |
|---------|-------|--------|
| Property type mismatch | `value` doesn't match declared `type` | Rejected — error message names the property and expected type |
| Property name format | Key not kebab-case | Rejected — error message shows invalid key |
| Missing required property | Page type schema marks property as required, client omitted it | Rejected — error message names the missing property |
| Unknown property | Key not in page type schema (typed pages only) | Rejected — error message names the unknown property |
| Invalid pageType GUID | GUID doesn't match any page type in DynamoDB | Rejected — page type not found |
| Child type constraint | Parent doesn't allow this child type, or child doesn't allow this parent type | Rejected — constraint error |

### 4. Update Page Properties (Merge)

**Actor**: MCP client
**Action**: Calls `update_page` with `pageGuid` and `properties` containing only the properties to change. Omitted properties are preserved. A property set to `null` is removed.

Example — update state and remove service, leave everything else:
```json
{
  "pageGuid": "page-guid-here",
  "properties": {
    "state": { "type": "string", "value": "Watching" },
    "service": null
  }
}
```

**Output**: Page GUID, title, modification timestamp.
**Failure modes**: Same validation as create (type mismatch, name format, required field). Additionally:

| Failure | Cause | Effect |
|---------|-------|--------|
| Removing a required property | `null` sent for a property the page type marks as required | Rejected — cannot remove required property |
| Page not found | Invalid pageGuid | Rejected |
| Page archived | Only published pages can be updated | Rejected |

### 5. Verify Result

**Actor**: MCP client
**Action**: Calls `get_page` to read the page back. Parses YAML frontmatter to confirm properties were written correctly.
**Output**: Confirmation that stored properties match what was sent.
**Failure**: Properties missing or malformed in frontmatter — indicates a serialization bug, not a client error.

## Termination

The page exists in S3 with correct YAML frontmatter containing all typed properties conforming to the page type schema. The page index in DynamoDB has the updated title and timestamp.

## Decisions

1. **Unknown properties are rejected.** If a page has a `pageType`, only properties defined in that type's schema are accepted. Prevents typos and schema drift.
2. **No pageType required to write properties.** Untyped pages can have properties — input validation (kebab-case, type/value consistency) still applies, but schema-level validation (required fields, allowed properties) only activates when a `pageType` is set.
3. **Default values are auto-filled.** When creating a typed page, omitted non-required properties that have a `defaultValue` in the page type schema are automatically populated.

## How Will You Know It's Working

- **Locally**: MCP inspector or direct HTTP calls to the Lambda function URL with property payloads. Verify S3 objects contain correct YAML frontmatter.
- **In tests**: Unit tests for validation logic (type mismatch, missing required, null-to-delete). Integration tests for round-trip: create with properties, get, verify, update one property, get, verify merge.
- **In production**: Failed validation returns structured MCP error responses. CloudWatch logs show validation rejections with property names and expected types.
