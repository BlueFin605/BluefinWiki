# Step 6.6 — Search `aria-live` region

| | |
|---|---|
| Phase | 6 — Search dialog |
| Gap refs | §3.6 "aria-live region"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | 6.1 (dialog structure) |
| Est. size | XS |

## Problem

React has an `aria-live` region announcing "Searching…" / "N results found" /
"No results". Angular has none.

## Target behaviour

- A visually-hidden `aria-live="polite"` region in the dialog that updates to:
  - "Searching…" while a request is in flight,
  - "{N} results found" when results land (N > 0),
  - "No results" when a completed search returns nothing.
- Debounced so rapid typing doesn't spam the region (announce on settle).

## Implementation notes

**Files:** `features/search/search-dialog.ts`.

- A `liveMessage` computed from the existing loading / results signals; render
  in a `<span class="sr-only" aria-live="polite">`.
- Reuse the app's existing sr-only utility class if there is one.

## Tests first (TDD)

- `search-dialog.spec.ts`: in-flight → region text "Searching…"; 3 results →
  "3 results found"; 0 results (completed) → "No results"; empty query → region
  empty.

## Acceptance criteria

- [ ] `aria-live` region present and visually hidden.
- [ ] Announces the three states correctly.
- [ ] Test covers each state.

## Out of scope

- Result count + timing footer (already present).
