# Step 4.4 — Page Type select + schema merge

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Properties — Page Type"; §7 note; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | 1.1 (page-types map) |
| Est. size | M |

## Problem

React: the Page Type select is **hidden entirely** when no types exist;
changing type **merges the schema** into the page's properties. Angular: always
shown ("(none)" + types); `custom-properties-editor` renders schema fields but
the merge is **display-only — not persisted unless the user edits a field**.

## Target behaviour

- Hide the Page Type control when the page-types map is empty.
- On changing the page type:
  - build the merged property set: new type's schema defaults, keeping any
    existing values whose name+type still apply, dropping properties not in the
    new schema (or keep them as ad-hoc — match React; React merges schema in,
    keeps compatible values),
  - **persist** the merged set with the type change (`updatePage` body includes
    `pageType` + `properties`), without requiring the user to touch a field.
- Invalidate `page:<guid>` per step 1.2.

## Implementation notes

**Files:** `features/editor/page-properties-panel.ts` /
`features/editor/custom-properties-editor.ts`, `features/pages/page-detail.ts`
(the update call), a pure `mergeSchema(existingProps, newSchema)` helper
(shareable with step 2.6's inheritance builder — keep them consistent).

- The `mergeSchema` helper is the crux; unit-test it hard.
- "Hidden when no types" — a simple `@if (pageTypesMap().size)` guard.

## Tests first (TDD)

- `merge-schema.spec.ts`: defaults applied for new fields; compatible existing
  values retained; incompatible-type field replaced with the default;
  determinism.
- `page-properties-panel.spec.ts`: empty map → no Page Type control; selecting
  a type calls `updatePage` with `pageType` + a merged `properties` object
  (without any field edit).

## Acceptance criteria

- [ ] Page Type control hidden when no types.
- [ ] Type change persists a merged property set immediately.
- [ ] `mergeSchema` unit-tested and shared with step 2.6.
- [ ] `page:<guid>` invalidated.

## Out of scope

- Ad-hoc add/remove + collapsibility (→ 4.7).
- Tag vocab (→ 4.5).
