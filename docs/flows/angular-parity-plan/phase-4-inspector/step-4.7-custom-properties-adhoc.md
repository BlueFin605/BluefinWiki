# Step 4.7 — Custom Properties: ad-hoc add/remove + collapsible

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Properties — Custom Properties"; §11 checklist; punch list 🔴 #9 |
| Impact | 🔴 Functional |
| Depends on | 1.1 (schema), 4.5 (tag input) |
| Est. size | M |

## Problem

React `CustomPropertiesEditor`: **collapsible**; schema merged with saved
values; per-type inputs text / number / date / **tags with vocab
autocomplete**; **add ad-hoc property** (kebab name, choose type) + **remove**.
Angular `custom-properties-editor.ts`: renders the fixed type-schema fields
only; text / number / date / **plain comma-text for tags**; **not collapsible**;
**cannot add or remove ad-hoc properties**.

## Target behaviour

- The whole section is **collapsible** (collapsed/expanded state — local is
  fine; persistence optional).
- Values shown = schema fields merged with saved values (reuse `mergeSchema`
  from step 4.4).
- Per-type editors: text, number (numeric input), date (date picker), **tags**
  (the chip input from step 4.5 with vocab autocomplete — not comma text).
- **Add ad-hoc property:** a small form — name (kebab-cased, validated
  non-empty + unique against existing keys) + type select
  (Text/Number/Date/Tags). Adds an entry to the page's `properties` not backed
  by the schema.
- **Remove:** ad-hoc properties can be removed; schema-defined ones cannot
  (match React — schema fields are fixed, only ad-hoc are removable).
- Changes persist via `updatePage` `properties`.

## Implementation notes

**Files:** `features/editor/custom-properties-editor.ts`,
possibly `features/editor/page-properties-panel.ts`.

- Distinguish schema keys vs ad-hoc keys: `schemaKeys = new Set(schema.map(f => f.name))`;
  a property whose key is not in `schemaKeys` is ad-hoc → show the remove
  button.
- Kebab-case + uniqueness validation as a pure helper (mirror
  `page-types-admin`'s property-name rules).
- Tags editor: extract step 4.5's chip+autocomplete into a reusable
  `TagInputComponent` so both the Tags property and ad-hoc tag properties use
  it.

## Tests first (TDD)

- `custom-properties-editor.spec.ts`: section collapses/expands; a schema field
  has no remove button; adding an ad-hoc "release-year" of type Number renders
  a numeric input and appears in the emitted properties; removing it drops it;
  duplicate / blank / non-kebab names are rejected with a message; a Tags
  property uses the chip input, not comma text.

## Acceptance criteria

- [ ] Section is collapsible.
- [ ] Ad-hoc properties can be added (kebab name + type) and removed.
- [ ] Schema properties cannot be removed.
- [ ] Tags use the vocab chip input.
- [ ] Name validation (non-empty, unique, kebab) enforced.
- [ ] Persisted via `updatePage`; unit tests cover add/remove/validate/collapse.

## Out of scope

- Page Type selection + schema merge on type change (→ 4.4).
