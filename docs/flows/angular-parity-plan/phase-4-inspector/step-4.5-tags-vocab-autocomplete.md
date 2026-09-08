# Step 4.5 — Tags: vocab autocomplete + behaviours

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Properties — Tags"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | S |

## Problem

React tag chips: `Enter`/`,` add (**lower-cased**, deduped); `Backspace` on an
empty input removes the last chip; **vocabulary autocomplete** from
`page-tags` (top 5). Angular `mat-chip-grid`: `Enter`/`,` add, dedupe — but
**no lower-casing, no Backspace-removes-last, no vocabulary autocomplete**.

## Target behaviour

- New tags are **lower-cased** and trimmed before add; dedupe is
  case-insensitive.
- `Backspace` with an empty input field removes the last chip.
- As the user types, show up to **5** suggestions from the tag vocabulary
  endpoint (`GET /page-tags` or equivalent — confirm the route; React calls it
  `page-tags`), excluding already-applied tags; picking one adds it.

## Implementation notes

**Files:** `features/editor/page-properties-panel.ts` /
`custom-properties-editor.ts` (wherever the tag chip grid lives), a
`Tags`/`PageTags` service method for the vocabulary (add if missing, following
the existing API-service pattern + step 1.2 invalidation tag `page-tags`).

- `matAutocomplete` wired to the `mat-chip-grid` input.
- Lower-case + dedupe in the add handler; guard the empty-Backspace case
  (`matChipInput` gives you the input value — check it's empty).

## Tests first (TDD)

- `page-properties-panel.spec.ts`: adding "Foo" stores "foo"; adding "FOO"
  again is a no-op; Backspace on empty removes the last chip; typing filters
  vocabulary suggestions to ≤5 excluding applied tags; selecting a suggestion
  adds it.

## Acceptance criteria

- [ ] Tags lower-cased + case-insensitively deduped.
- [ ] Backspace-on-empty removes the last chip.
- [ ] Up to 5 vocabulary suggestions; applied tags excluded.
- [ ] Tests cover lower-case, dedupe, backspace, suggestions.

## Out of scope

- The same tag input inside ad-hoc custom properties (→ 4.7 reuses this).
