# Phase 4 — Inspector

**Goal:** bring the inspector panel (Properties / Attachments / Links tabs) to
React parity — layout binding, title↔H1 sync, schema/tag handling, ad-hoc
properties, and the attachment manager.

**Depends on:** Phase 1 (step 1.1 page-types map, step 1.3 layout store),
Phase 3 step 3.7 (the `WikiImage` authed-image component, reused for
thumbnails/lightbox in step 4.8).

## Steps

| # | Step | Impact | Depends on |
|---|---|---|---|
| 4.1 | [Inspector layout binding](step-4.1-inspector-layout-binding.md) | 🟠 | 1.3; 1b.5 (mobile) |
| 4.2 | [Backlinks badge](step-4.2-backlinks-badge.md) | 🟠 | — |
| 4.3 | [Title ↔ H1 sync + empty reset](step-4.3-title-h1-sync.md) | 🟠 | — |
| 4.4 | [Page Type select + schema merge](step-4.4-page-type-select-schema-merge.md) | 🟠 | 1.1 |
| 4.5 | [Tags: vocab autocomplete + behaviours](step-4.5-tags-vocab-autocomplete.md) | 🟠 | — |
| 4.6 | [Timestamps localization](step-4.6-timestamps-localization.md) | ⚪→do | — |
| 4.7 | [Custom Properties: ad-hoc + collapsible](step-4.7-custom-properties-adhoc.md) | 🔴 | 1.1, 4.5 |
| 4.8 | [Attachment manager](step-4.8-attachment-manager.md) | 🔴 | 3.7 |
| 4.9 | [Attachment upload auto-insert](step-4.9-attachment-upload-autoinsert.md) | 🟠 | 3.4 (shared insert) |

Parallel-safe: {4.2, 4.3, 4.6} independent; 4.4 & 4.7 after 1.1; 4.5 before 4.7;
4.8 after 3.7; 4.1 after 1.3.

## Phase exit criteria

All ticked items are jsdom / Testing-Library verified (89 suites / 742 tests
green, `npm run lint` + `tsc --noEmit` clean at `6b416db`, after the
whole-branch review + fix wave). Real-browser drag-feel, lightbox, and
drag-link smoke checks are still owed — see follow-ups. Two items are deferred
to step 1b.3 (noted inline).

- [x] All step acceptance criteria met; `npm test` + `npm run lint` green
      (whole-branch review passed *with fixes* — 1 Critical + Importants fixed in
      `6b416db`; Minor roll-up carried to the branch-finish sweep).
- [x] inspector open/close persists (`Layout.inspectorVisible`); width bound to
      `Layout.inspectorWidth` + divider (4.1). Mobile sheet = hook only (→ 1b.5).
- [x] Links tab shows a backlink count badge (4.2) — with an `aria-label` so the
      count reaches assistive tech.
- [x] editing the Title when line 1 is `# H1` rewrites that H1 (CodeMirror
      transaction, feedback-loop guarded, CRLF-safe); blanking it reverts on blur
      and never persists empty (4.3).
- [x] Page Type select hidden when no types exist; changing type persists a
      **union-merged** property set immediately without further edits — non-schema
      props kept (no data loss on type switch); "(none)" clears only the type (4.4).
- [x] tag input lower-cases, case-insensitively dedupes, Backspace-on-empty
      removes the last chip, and suggests ≤5 vocabulary terms excluding applied
      (4.5, extracted `wiki-tag-input`).
- [x] custom properties are collapsible; ad-hoc properties can be added (kebab
      name + type) and removed; renders on **untyped** pages too (4.7).
- [x] attachment manager auto-retries on load failure (1s→30s, 10 total
      attempts) with a Refresh that resets the backoff; sorts newest-first; type
      emoji + thumbnail → lightbox for images; Download / Copy Markdown / Drag
      Link / Insert / Delete all present (4.8). *Deferred to 1b.3: a visible
      "retrying (n of 10)" status; the Properties-tab resource re-fetch on every
      tab switch.*
- [x] uploading an attachment auto-inserts its markdown at the cursor via the
      shared insert route (4.9).
