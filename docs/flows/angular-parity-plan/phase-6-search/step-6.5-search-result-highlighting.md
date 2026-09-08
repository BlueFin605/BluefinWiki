# Step 6.5 — Result highlighting + tags + snippet clamp

| | |
|---|---|
| Phase | 6 — Search dialog |
| Gap refs | §3.6 "Results — matched terms highlighted…"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | S |

## Problem

React result rows: matched terms `<mark>`-highlighted in title + snippet; up to
**3 tags**; **2-line snippet clamp**; folder path. Angular: title + path +
snippet only — **plain, no highlight, no tags, no clamp**.

## Target behaviour

- Highlight the query terms in both the title and the snippet by wrapping
  matches in `<mark>` (case-insensitive; escape the query for regex; escape the
  source text for HTML before inserting `<mark>` to avoid injection).
- Render up to 3 tags per result (if the result payload carries tags — confirm;
  if not, note it).
- Clamp the snippet to 2 lines with CSS (`-webkit-line-clamp: 2` /
  `line-clamp`).
- Keep the folder path.

## Implementation notes

**Files:** `features/search/search-dialog.ts` (row template + a
`highlight(text, query)` pure helper returning safe HTML or a
segment array the template renders).

- Prefer returning **segments** (`{ text, match }[]`) and rendering with
  `@for` + `<mark>` — avoids `innerHTML` entirely. Cleaner and safe.

## Tests first (TDD)

- `highlight.spec.ts`: `highlight('Hello World', 'world')` → segments with
  "World" marked; multiple occurrences; no match → single unmarked segment;
  regex-special query chars handled; HTML-special text not executed.
- `search-dialog.spec.ts`: a row renders `<mark>` around the term in title +
  snippet; ≤3 tags; the snippet element has the clamp class.

## Acceptance criteria

- [ ] Query terms highlighted in title + snippet, injection-safe.
- [ ] Up to 3 tags shown (or documented absent from the payload).
- [ ] Snippet clamped to 2 lines.
- [ ] `highlight` unit-tested including edge cases.

## Out of scope

- Debounce alignment 200→300 ms (⚪).
