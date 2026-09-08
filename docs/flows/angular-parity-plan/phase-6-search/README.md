# Phase 6 — Search dialog

**Goal:** bring the search dialog (`search-dialog.ts`, `search.ts`) to React
parity — keyboard navigation, pagination, rate limiting, recent searches,
result highlighting, a11y, and a visible open affordance.

**Depends on:** step 1.5 (mobile top bar) for step 6.7's mobile button — soft
dependency; the sidebar button can land first.

**Note:** semantic `/search` + input sanitisation already match
("ports ClientSearchService byte-for-byte"). Scope select (`All / Titles /
Content`) is already richer than React — verify the backend honours `scope`,
otherwise leave it.

## Steps

| # | Step | Impact | Depends on |
|---|---|---|---|
| 6.1 | [Keyboard navigation](step-6.1-search-keyboard-nav.md) | 🔴 | — |
| 6.2 | [Pagination / infinite scroll](step-6.2-search-pagination.md) | 🔴 | — |
| 6.3 | [Client rate-limit 60/min](step-6.3-search-rate-limit.md) | 🟠 | — |
| 6.4 | [Recent searches](step-6.4-recent-searches.md) | 🟠 | — |
| 6.5 | [Result highlighting + tags + clamp](step-6.5-search-result-highlighting.md) | 🟠 | — |
| 6.6 | [`aria-live` region](step-6.6-search-aria-live.md) | 🟠 | 6.1 |
| 6.7 | [Visible Search button](step-6.7-search-visible-button.md) | 🟠 | 1.5 (mobile) |

Parallel-safe: all seven touch `search-dialog.ts` / `search.ts` heavily —
recommend **sequential** in listed order to avoid merge churn, or split
`search.ts` (rate-limit 6.3, recent 6.4) from `search-dialog.ts` (rest).

## Phase exit criteria

- [ ] All step acceptance criteria met; `npm test` + `npm run lint` green.
- [ ] Manual: `↑/↓/Home/End` move selection, `Enter` opens, `Ctrl/Cmd+Enter`
      opens in a new tab, hover sets selection, selected row scrolls into view.
- [ ] Manual: results paginate with "Load more results (N of M)" / infinite
      scroll.
- [ ] Manual: >60 searches/min shows "Too many searches. Please wait a moment."
- [ ] Manual: empty query shows recent searches; per-item remove + Clear all;
      a selection is recorded.
- [ ] Manual: matched terms are `<mark>`-highlighted in title + snippet; up to
      3 tags; snippet clamped to 2 lines.
- [ ] Manual: a screen reader announces "Searching…" / "N results found" /
      "No results".
- [ ] Manual: a visible Search button opens the dialog (sidebar header; mobile
      top bar once 1.5 lands).
