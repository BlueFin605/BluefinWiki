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
| 4.1 | [Inspector layout binding](step-4.1-inspector-layout-binding.md) | 🟠 | 1.3, 1.5 |
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

- [ ] All step acceptance criteria met; `npm test` + `npm run lint` green.
- [ ] Manual: inspector open/close persists (`inspectorVisible`); width
      draggable + persisted.
- [ ] Manual: Links tab shows a backlink count badge.
- [ ] Manual: editing the Title when line 1 is `# H1` rewrites that H1; blanking
      it resets on blur.
- [ ] Manual: Page Type select is hidden when no types exist; changing type
      merges schema defaults and they persist without further edits.
- [ ] Manual: tag input lower-cases, dedupes, Backspace removes the last chip,
      and suggests vocabulary terms.
- [ ] Manual: custom properties are collapsible; ad-hoc properties can be added
      (kebab name + type) and removed.
- [ ] Manual: attachment manager auto-retries on load failure, has a Refresh,
      sorts newest-first, shows thumbnails → lightbox, and offers Download /
      Copy Markdown / Drag Link / Insert / Delete.
- [ ] Manual: uploading an attachment inserts its markdown at the cursor
      automatically.
