# Step 6.2 — Search pagination / infinite scroll

| | |
|---|---|
| Phase | 6 — Search dialog |
| Gap refs | §3.6 "Infinite scroll + Load more results", "Page size 10/25/50"; §11 checklist; punch list 🔴 #12 |
| Impact | 🔴 Functional |
| Depends on | — |
| Est. size | M |

## Problem

`search.ts` hardcodes `limit=10`; the dialog shows the first 10 only. React has
**infinite scroll + "Load more results (N of M)"** and a page-size control
(10 / 25 / 50) in a filter panel.

## Target behaviour

- The search request takes a page size (default 10) and a cursor/offset.
- Results accumulate; when more are available show "Load more results (N of M)"
  and/or auto-load on scroll near the bottom of the list.
- A page-size selector (10 / 25 / 50); changing it re-runs the search from the
  start.
- Selection (step 6.1) is preserved across appends.

## Implementation notes

**Files:** `features/search/search.ts` (accept `limit` + `cursor`/`offset`,
return `hasMore` / `nextCursor` / `total`), `features/search/search-dialog.ts`
(accumulator + Load-more + IntersectionObserver on a sentinel row + page-size
select), `features/search/search.types.ts`.

- Confirm what the `/search` endpoint returns for paging (cursor vs
  offset+total); the analysis mentions "(N of M)" so a total is available.
- Mirror the board accumulator pattern from step 5.2 for consistency.

## Tests first (TDD)

- `search.spec.ts`: request carries the chosen `limit` + cursor; response
  parsing exposes `hasMore` / `total`.
- `search-dialog.spec.ts`: first search shows page 1 + "Load more (10 of 42)";
  clicking / scrolling loads and appends page 2; page-size change re-runs from
  scratch; selection index stays valid after append.

## Acceptance criteria

- [ ] Results paginate; "Load more results (N of M)" + scroll auto-load.
- [ ] Page-size selector 10/25/50; change re-runs the search.
- [ ] Accumulator resets on new query / page-size change.
- [ ] Tests cover paging, page-size, selection preservation.

## Out of scope

- Result rendering polish (→ 6.5).
