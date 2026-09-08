# Step 4.3 — Title ↔ H1 sync + empty reset

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Properties — Title"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | M |

## Problem

React's Title field: click-to-edit inline; typing updates metadata live; **if
line 1 of the content is `# H1`, editing the title rewrites that H1**; an empty
title on blur resets to the previous value. Angular: a plain always-visible
`matInput` with a debounced (200 ms) metadata update — **no H1 sync, no
empty-reset**, no click-to-edit affordance.

## Target behaviour

- Keep the debounced metadata update (200 ms).
- **H1 sync:** when the editor buffer's first non-empty line matches
  `^#\s+(.*)$`, editing the Title also rewrites that line to `# <newTitle>`
  (via the CodeMirror API so undo is coherent). If line 1 is not an H1, do
  nothing to the content.
- **Empty reset:** if the field is blank/whitespace on blur, restore the last
  non-empty value; do not persist an empty title.
- **Click-to-edit:** show the title as text with an edit affordance; clicking
  turns it into the input (focus + select). Matches React; low effort with a
  local `editing` signal.

## Implementation notes

**Files:** `features/editor/page-properties-panel.ts` (the Title control) or
`features/editor/inspector-panel.ts`, plus a bridge to the editor buffer —
`features/pages/page-detail.ts` exposes a `setFirstH1(text)` that calls into
`wiki-codemirror`.

- Pure helpers: `firstLineIsH1(markdown) => boolean` and
  `rewriteFirstH1(markdown, title) => markdown` (or the CM-transaction
  equivalent).
- Guard against a feedback loop: rewriting the H1 must not re-trigger a Title
  update that rewrites the H1 again.

## Tests first (TDD)

- `title-h1.spec.ts`: `firstLineIsH1('# Hello\n\nx')` true; `('Hello')` false;
  `rewriteFirstH1('# Old\n\nx', 'New')` → `'# New\n\nx'`; non-H1 first line
  unchanged.
- `page-properties-panel.spec.ts`: typing a title with an H1 first line updates
  the buffer; blanking the field and blurring restores the prior title and
  does not persist empty; click-to-edit toggles the input.

## Acceptance criteria

- [ ] Editing the Title rewrites a leading `# H1`; leaves non-H1 content alone.
- [ ] Blank title on blur resets; never persisted.
- [ ] Click-to-edit affordance works.
- [ ] No infinite sync loop.
- [ ] Helpers + panel behaviour unit-tested.

## Out of scope

- Status control / Page ID field (⚪).
