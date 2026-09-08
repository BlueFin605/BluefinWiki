# Step 5.2 — Pagination / Load-more

| | |
|---|---|
| Phase | 5 — Board view |
| Gap refs | §3.5 "Data"; §11 checklist; punch list 🔴 #11 |
| Impact | 🔴 Functional |
| Depends on | — |
| Est. size | M |

## Problem

React fetches `GET …/children?include=properties` (+ `type=`, `depth=` for deep
boards, cap 10), cursor-paginated, page size 200, with a **"Load more cards"**
control. Angular fetches with `limit:200` (+ `type`/`depth`) but
`BoardView` **never reads `hasMore` / `nextCursor`** — no Load-more, boards
silently cap at 200.

## Target behaviour

- `BoardView` accumulates pages: start with the first 200, and when `hasMore`
  is true show a "Load more cards" button that fetches the next page via
  `nextCursor` and appends.
- Grouping / sorting / column assignment recompute over the accumulated set.
- Deep boards (`depth` up to 10) paginate the same way.
- A loading indicator on the button while fetching.

## Implementation notes

**Files:** `features/board/board-view.ts`, `features/pages/pages.ts`
(`childrenWithPropertiesResource` already supports `cursor` — the consumer must
drive it).

- `rxResource` per page is awkward for accumulation. Options:
  - keep a `signal<PageChildDetail[]>` accumulator + a `cursor` signal; on
    "Load more", imperatively fetch (`firstValueFrom`) the next page and
    append; or
  - a paged resource pattern where the params include the cursor and the
    stream merges — simplest is the imperative accumulator.
- Reset the accumulator when `parentGuid` / `targetTypeGuid` / `depth` change,
  or when step 1.2 invalidates `children:<parent>`.

## Tests first (TDD)

- `board-view.spec.ts`: first load shows ≤200 cards + a "Load more" button when
  `hasMore`; clicking it fetches with the `nextCursor` and appends;
  no button when `hasMore` is false; changing the parent resets the
  accumulator.

## Acceptance criteria

- [ ] "Load more cards" appears when `hasMore`; loads and appends the next
      page.
- [ ] Grouping/sorting recompute over the full accumulated set.
- [ ] Accumulator resets on parent/config change + invalidation.
- [ ] Tests cover has-more, load, no-more, reset.

## Out of scope

- `boardOrder` reorder (→ 5.4).
