# Step 2.7 — Create-Page-from-Link

| | |
|---|---|
| Phase | 2 — Page tree & CRUD |
| Gap refs | §3.3 "Create Page from Link modal"; punch list 🔴 #4 |
| Impact | 🔴 Functional |
| Depends on | pairs with step 3.8 (broken-link detection wiring) |
| Est. size | M |

## Problem

`create-page-from-link-modal.ts` pre-fills the title from the link text and
validates 3–100 (✅), but:

- **No root/parent choice** — it silently uses the current page as parent (or
  root if none). React offers a "Create as root page" checkbox + parent
  `<select>` + "will be created under the current page" hint.
- **No source-markdown rewrite** — the modal creates the page and closes;
  `page-detail.onBrokenLink` awaits the close and does nothing with the result.
  The broken link stays broken. React rewrites `[[target]]` /
  `[[target|text]]` → `[[newGuid|text]]` in the **source** page's markdown and
  the user saves manually.

## Target behaviour

- Modal adds: a "Create as root page" checkbox; when unchecked, a parent
  selector (default = current page) + the hint text.
- On success the modal returns `{ newGuid, linkText, originalTarget }` to the
  caller.
- `page-detail.onBrokenLink` consumes that: rewrite every
  `[[originalTarget]]` and `[[originalTarget|text]]` occurrence in the current
  editor buffer to `[[newGuid|text]]` (preserve display text; when there was
  none, use the original target text as the display text). Mark the buffer
  dirty and show a hint: "Link updated — save the page to keep the change."
- Do **not** auto-save (React parity — user saves manually).

## Implementation notes

**Files:** `features/pages/create-page-from-link-modal.ts`,
`features/pages/page-detail.ts` (`onBrokenLink`),
a pure `rewriteWikiLink(markdown, fromTarget, toGuid)` helper
(reuse / align with `shared/markdown/wiki-link-parser.ts` regexes).

- The rewrite must be surgical: only `[[…]]` tokens whose target matches
  `fromTarget` (trimmed, case-insensitive per the parser's rules), not
  arbitrary text.
- Apply via the CodeMirror API (`wiki-codemirror`) so undo history is coherent.

## Tests first (TDD)

- `rewrite-wiki-link.spec.ts`: `[[Foo]]` → `[[<guid>|Foo]]`;
  `[[Foo|bar]]` → `[[<guid>|bar]]`; `[[Foobar]]` (different target) untouched;
  multiple occurrences all rewritten; code fences left alone if the parser
  already excludes them.
- `create-page-from-link-modal.spec.ts`: root checkbox toggles the parent
  selector; result payload includes `newGuid` + `linkText` + `originalTarget`.
- `page-detail.spec.ts`: after the modal resolves, the buffer contains the
  rewritten link, is dirty, and the "save the page" hint is shown; no PUT
  fired automatically.

## Acceptance criteria

- [ ] Root/parent choice present and functional.
- [ ] Source markdown is rewritten to `[[newGuid|text]]` on success.
- [ ] "Save the page" hint shown; no auto-save.
- [ ] `rewriteWikiLink` is a tested pure helper.

## Out of scope

- Detecting *which* links are broken in the first place (→ step 3.8 wires the
  `pageExists` resolver that makes `onBrokenLink` reachable).
