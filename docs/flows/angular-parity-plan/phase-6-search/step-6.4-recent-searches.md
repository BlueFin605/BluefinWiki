# Step 6.4 — Recent searches

| | |
|---|---|
| Phase | 6 — Search dialog |
| Gap refs | §3.6 "Recent searches"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | S |

## Problem

React keeps recent searches in `localStorage`, shows them when the query is
empty, allows per-item remove and "Clear all", and records a term on selection.
Angular has none.

## Target behaviour

- `recentSearches` persisted to `localStorage` (key e.g.
  `bluefinwiki:recent-searches`), capped (~8–10), most-recent first, deduped.
- Shown in the dialog when the query input is empty.
- Each item: click to re-run; an `×` to remove that item; a "Clear all" action.
- A term is recorded when the user **selects a result** (React records on
  selection, not on every keystroke).
- All storage access wrapped in try/catch (private mode / disabled storage).

## Implementation notes

**Files:** `features/search/search.ts` (or a `RecentSearches` service),
`features/search/search-dialog.ts` (empty-state UI).

- Pure list ops: `addRecent(list, term)` (dedupe + cap + prepend),
  `removeRecent(list, term)`.

## Tests first (TDD)

- `recent-searches.spec.ts`: add dedupes + caps + orders most-recent-first;
  remove drops one; clear empties; storage errors are swallowed.
- `search-dialog.spec.ts`: empty query renders the recent list; clicking an
  item runs that search; `×` removes it; selecting a result records the current
  term.

## Acceptance criteria

- [ ] Recent searches persist, dedupe, cap, and show on empty query.
- [ ] Per-item remove + Clear all.
- [ ] Recorded on result selection.
- [ ] Storage failures don't throw.
- [ ] List ops + dialog behaviour unit-tested.

## Out of scope

- Server-side history.
