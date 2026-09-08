# Step 3.9 — Preview: typography polish

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 Preview "Empty content", "Full prose typography" |
| Impact | ⚪ in the doc — small, bundled here (h4–h6 + table scroll are borderline 🟠) |
| Depends on | — |
| Est. size | XS |

## Problem

- **Empty content** renders an empty `.wiki-markdown` div — no placeholder.
  React shows "No content yet. Start writing…" (italic).
- **Typography** is hand-rolled CSS: only h1–h3 styled (h4–h6 unstyled);
  tables get `width:100%` with **no horizontal scroll wrapper**; blockquote bar
  is fine.

## Target behaviour

- Empty (or whitespace-only) content → the italic "No content yet. Start
  writing…" placeholder.
- h4, h5, h6 get sensible sizes/weights consistent with the h1–h3 scale.
- Wide tables are wrapped in an `overflow-x: auto` container so they scroll
  inside the pane instead of blowing out the layout.

## Implementation notes

**Files:** `shared/markdown/markdown-renderer.ts` (empty check + template),
its stylesheet / the `.wiki-markdown` styles, `shared/markdown/unified-pipeline.ts`
(wrap `<table>` in a scroll container — a small rehype step, or post-process
the HTML string).

- Empty check: trim the input markdown; if falsy, render the placeholder
  instead of the pipeline output.
- Table wrap: a rehype plugin that wraps each `table` node in a
  `div.table-scroll`, or a string post-process — match whatever pattern the
  pipeline already uses.

## Tests first (TDD)

- `markdown-renderer.spec.ts`: empty / whitespace markdown → placeholder text;
  non-empty → no placeholder.
- `unified-pipeline.spec.ts`: a markdown table produces a
  `div.table-scroll > table`.
- Style assertion is light — a snapshot or a class-presence check for h4–h6 is
  enough.

## Acceptance criteria

- [ ] Empty content shows the italic placeholder.
- [ ] h4–h6 are styled.
- [ ] Wide tables scroll within their container; the page body never scrolls
      horizontally because of a table.
- [ ] Tests cover empty-state + table wrap.

## Out of scope

- Matching Tailwind `prose` exactly (⚪ — Material styling is accepted).
