# Step 3.10 — Table of Contents

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 "Table of contents" ("entirely absent"); §11 checklist; punch list 🔴 #8 |
| Impact | 🔴 Functional |
| Depends on | Phase 1b (step 1b.8) for the mobile bar wiring |
| Est. size | M |

## Problem

No TOC component exists. React's: parses `##`–`######` (skipping fenced code),
shows only if **≥3** headings; desktop is a sticky 224 px right rail titled
"On this page" with `IntersectionObserver` active-heading tracking + smooth
scroll + hash; mobile is a collapsible bar.

## Target behaviour

- A `WikiTableOfContents` component fed the rendered content (or the heading
  list extracted from it).
- **Parse:** headings level 2–6, skipping any inside fenced code blocks. Each
  entry = `{ level, text, slug }` where `slug` matches the renderer's GitHub
  slugify (reuse `slugify` from the pipeline — do not reimplement).
- **Visibility:** render nothing if fewer than 3 headings.
- **Desktop:** sticky right rail, ~224 px, heading "On this page"; nested
  indentation by level; the entry for the currently-visible section is
  highlighted via `IntersectionObserver`; clicking an entry smooth-scrolls to
  the slug and sets `location.hash`.
- **Mobile:** a collapsible bar (collapsed by default) — behaviour detail owned
  by Phase 1b (step 1b.8); expose a `compact`/`mobile` input.
- Placement: alongside the preview pane in View/Preview/Split modes.

## Implementation notes

**Files:** new `shared/markdown/table-of-contents.ts` (or
`shared/components/`), consumed by `features/pages/page-detail.ts` /
wherever the preview renders; a pure `extractHeadings(markdown)` helper.

- `IntersectionObserver` with a rootMargin that biases toward "heading near the
  top counts as active"; disconnect on destroy.
- If the renderer already emits heading `id`s (it does — slugs), the TOC only
  needs the DOM ids to observe; get the heading list from the markdown, then
  `document.getElementById(slug)` for each.

## Tests first (TDD)

- `extract-headings.spec.ts`: `##`–`######` captured; `#` (h1) excluded per
  React; headings inside ``` fences ignored; slugs match `slugify`.
- `table-of-contents.spec.ts`: <3 headings → renders nothing; ≥3 → list with
  correct nesting; clicking an entry calls `scrollIntoView` on the target and
  sets the hash; the observed active entry gets the active class.

## Acceptance criteria

- [ ] TOC appears only with ≥3 headings (h2–h6).
- [ ] Active-heading tracking via `IntersectionObserver`.
- [ ] Click → smooth scroll + hash.
- [ ] `compact`/mobile input exists (wired by 1.5).
- [ ] Slugs reuse the pipeline `slugify`.
- [ ] Helper + component unit-tested.

## Out of scope

- Final mobile bar styling/behaviour (→ 1.5).
